'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

type Props = {
  filterRol?: string;
  filterId?: string;
  storageKey: string;
};

const TIPO_ICON: Record<string, string> = {
  solicitud:    'fa-file-lines text-yellow-400',
  transferencia:'fa-building-columns text-blue-400',
  pago:         'fa-circle-check text-emerald-400',
  info:         'fa-circle-info text-gray-400',
};

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const play = (freq: number, start: number, dur: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    };
    play(880,  ctx.currentTime,        0.18);
    play(1100, ctx.currentTime + 0.14, 0.22);
  } catch {}
}

export function NotifBell({ filterRol, filterId, storageKey }: Props) {
  const [notifs,   setNotifs]   = useState<any[]>([]);
  const [open,     setOpen]     = useState(false);
  const [unread,   setUnread]   = useState(0);
  const [toast,    setToast]    = useState<{ titulo: string; mensaje: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const knownIds    = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const toastTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mostrar toast ──────────────────────────────────────────────
  function showToast(titulo: string, mensaje: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ titulo, mensaje });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  // ── Consulta a la BD y detecta nuevas ─────────────────────────
  const load = useCallback(async (checkNew = false) => {
    if (!filterRol && !filterId) return;

    let q = supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40);
    if (filterRol) q = q.eq('destinatario_rol', filterRol);
    if (filterId)  q = q.eq('destinatario_id',  filterId);

    const { data } = await q;
    if (!data) return;

    // Detectar notificaciones genuinamente nuevas
    if (checkNew && initialized.current) {
      const nuevas = data.filter(n => !knownIds.current.has(n.id));
      if (nuevas.length > 0) {
        playNotifSound();
        showToast(nuevas[0].titulo, nuevas[0].mensaje);
      }
    }

    // Actualizar set de IDs conocidos
    knownIds.current = new Set(data.map((n: any) => n.id));

    setNotifs(data);
    const lastSeen = parseInt(localStorage.getItem(storageKey) || '0');
    setUnread(data.filter((n: any) => new Date(n.created_at).getTime() > lastSeen).length);
  }, [filterRol, filterId, storageKey]);

  // ── Suscripción real-time ──────────────────────────────────────
  useEffect(() => {
    if (!filterRol && !filterId) return;

    // Carga inicial
    load(false).then(() => { initialized.current = true; });

    const chName = `notif_${storageKey}_${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(chName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        () => load(true)   // re-consulta siempre (no depende de payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notificaciones' },
        () => load(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [load, filterRol, filterId, storageKey]);

  // ── Abrir / cerrar campana ─────────────────────────────────────
  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      localStorage.setItem(storageKey, Date.now().toString());
      setUnread(0);
    }
  };

  // ── Eliminar una ───────────────────────────────────────────────
  const eliminarUna = async (id: string) => {
    setDeleting(id);
    setNotifs(prev => prev.filter(n => n.id !== id));
    knownIds.current.delete(id);
    await fetch('/api/notifications/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setDeleting(null);
  };

  // ── Eliminar todas ─────────────────────────────────────────────
  const eliminarTodas = async () => {
    setNotifs([]);
    setUnread(0);
    knownIds.current.clear();
    await fetch('/api/notifications/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearAll: true, filterRol, filterId }),
    }).catch(() => {});
  };

  if (!filterRol && !filterId) return null;

  return (
    <>
      {/* Toast ──────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[600] w-[92vw] max-w-sm
                        bg-gray-900 border border-yellow-500/30 rounded-2xl shadow-2xl
                        flex items-start gap-3 px-4 py-3
                        animate-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-yellow-500/10 border border-yellow-500/30
                          flex items-center justify-center shrink-0 mt-0.5">
            <i className="fa-solid fa-bell text-yellow-400 text-xs" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold leading-tight">{toast.titulo}</p>
            <p className="text-gray-400 text-[10px] mt-0.5 leading-snug">{toast.mensaje}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-gray-600 hover:text-gray-300 shrink-0 mt-0.5 transition-colors"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
      )}

      {/* Campana ────────────────────────────────────────────────── */}
      <div className="relative">
        <button
          onClick={handleToggle}
          className="relative w-9 h-9 flex items-center justify-center rounded-full
                     border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500
                     active:bg-gray-800 transition-colors"
          aria-label="Notificaciones"
        >
          <i className="fa-solid fa-bell text-sm" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white
                             text-[9px] font-black rounded-full flex items-center justify-center
                             px-0.5 leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-[300]" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-11 z-[301] w-80 bg-gray-900 border border-gray-800
                            rounded-2xl shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                <p className="text-white font-bold text-sm">Notificaciones</p>
                {notifs.length > 0 && (
                  <button
                    onClick={eliminarTodas}
                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <i className="fa-solid fa-trash-can text-[9px]" />
                    Borrar todo
                  </button>
                )}
              </div>

              {/* Lista */}
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-800/50">
                {notifs.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <i className="fa-solid fa-bell-slash text-gray-700 text-2xl mb-2 block" />
                    <p className="text-gray-500 text-sm">Sin notificaciones</p>
                  </div>
                ) : notifs.map(n => (
                  <div
                    key={n.id}
                    className="px-4 py-3 flex gap-3 hover:bg-gray-800/30 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                      <i className={`fa-solid ${TIPO_ICON[n.tipo] ?? TIPO_ICON.info} text-xs`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold leading-tight">{n.titulo}</p>
                      <p className="text-gray-400 text-[10px] mt-0.5 leading-snug">{n.mensaje}</p>
                      <p className="text-gray-600 text-[9px] mt-1">
                        {new Date(n.created_at).toLocaleDateString('es-MX', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => eliminarUna(n.id)}
                      disabled={deleting === n.id}
                      className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400
                                 transition-all shrink-0 mt-1 self-start"
                      aria-label="Eliminar"
                    >
                      <i className="fa-solid fa-xmark text-[10px]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
