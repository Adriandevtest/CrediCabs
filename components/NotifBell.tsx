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

export function NotifBell({ filterRol, filterId, storageKey }: Props) {
  const [notifs, setNotifs]     = useState<any[]>([]);
  const [open, setOpen]         = useState(false);
  const [unread, setUnread]     = useState(0);
  const [toast, setToast]       = useState<{ titulo: string; mensaje: string } | null>(null);
  const toastTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad             = useRef(true);

  const load = useCallback(async (incoming?: any) => {
    if (!filterRol && !filterId) return;
    let q = supabase.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(30);
    if (filterRol) q = q.eq('destinatario_rol', filterRol);
    if (filterId)  q = q.eq('destinatario_id', filterId);

    const { data, error } = await q;
    if (error || !data) return;

    setNotifs(data);
    const lastSeen = parseInt(localStorage.getItem(storageKey) || '0');
    setUnread(data.filter(n => new Date(n.created_at).getTime() > lastSeen).length);

    // Show toast for new incoming notification (skip on first load)
    if (!isFirstLoad.current && incoming) {
      const n = data[0];
      if (n) showToast(n.titulo, n.mensaje);
    }
    isFirstLoad.current = false;
  }, [filterRol, filterId, storageKey]);

  function showToast(titulo: string, mensaje: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ titulo, mensaje });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  useEffect(() => {
    if (!filterRol && !filterId) return;
    load();
    const channelId = `notif_${storageKey}_${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        (payload) => load(payload.new))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [load, filterRol, filterId, storageKey]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) { localStorage.setItem(storageKey, Date.now().toString()); setUnread(0); }
  };

  if (!filterRol && !filterId) return null;

  return (
    <>
      {/* Toast banner */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[600] w-[90vw] max-w-sm
                     bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl
                     flex items-start gap-3 px-4 py-3
                     animate-in slide-in-from-top-3 duration-300"
        >
          <div className="w-8 h-8 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <i className="fa-solid fa-bell text-yellow-400 text-xs" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold leading-tight">{toast.titulo}</p>
            <p className="text-gray-400 text-[10px] mt-0.5 leading-snug">{toast.mensaje}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-gray-600 hover:text-gray-400 mt-0.5 shrink-0">
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
      )}

      <div className="relative">
        <button
          onClick={handleToggle}
          className="relative w-9 h-9 flex items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 active:bg-gray-800 transition-colors"
          aria-label="Notificaciones"
        >
          <i className="fa-solid fa-bell text-sm" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-[300]" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-11 z-[301] w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                <p className="text-white font-bold text-sm">Notificaciones</p>
                {notifs.length > 0 && (
                  <span className="text-gray-600 text-[10px]">{notifs.length} recientes</span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-800/50">
                {notifs.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <i className="fa-solid fa-bell-slash text-gray-700 text-2xl mb-2 block" />
                    <p className="text-gray-500 text-sm">Sin notificaciones</p>
                  </div>
                ) : notifs.map(n => (
                  <div key={n.id} className="px-4 py-3 flex gap-3 hover:bg-gray-800/30 transition-colors">
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
