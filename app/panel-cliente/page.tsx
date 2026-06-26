'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { NotifBell } from '../../components/NotifBell';
import { diasDeMora, MORA_POR_DIA } from '../../lib/mora';

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
          },
          'image/jpeg', 0.82
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function formatWA(tel: string) {
  const d = tel.replace(/\D/g, '');
  if (d.startsWith('52') && d.length >= 12) return d;
  if (d.length === 10) return '52' + d;
  return d;
}

type NavTab = 'inicio' | 'historial' | 'calendario' | 'cobrador';
type FiltroHist = 'todos' | 'pagados' | 'pendientes' | 'atrasados';

function NavBtn({ icon, label, active, badge, onClick }: {
  icon: string; label: string; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors ${
        active ? 'text-yellow-400' : 'text-gray-500 active:text-gray-300'
      }`}
    >
      {active && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-yellow-400 rounded-full" />
      )}
      <span className="relative">
        <i className={`fa-solid ${icon} text-xl`} />
        {badge ? (
          <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
}

const DIAS_ES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function PanelCliente() {
  const [datos, setDatos] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pagoReciente, setPagoReciente] = useState(false);
  const [tabActivo, setTabActivo] = useState(0);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [transferShow, setTransferShow] = useState(false);
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferError, setTransferError] = useState('');

  const [navTab, setNavTab] = useState<NavTab>('inicio');
  const [filtroHist, setFiltroHist] = useState<FiltroHist>('todos');
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calDia, setCalDia] = useState<string | null>(null);

  const router = useRouter();

  const cargarDatos = useCallback(async (id: string) => {
    try {
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes').select('*').eq('id', id).single();
      if (clienteError) throw clienteError;

      const { data: creditosData, error: creditosError } = await supabase
        .from('creditos').select('*, pagos_diarios(*)').eq('cliente_id', id);
      if (creditosError) throw creditosError;

      const { data: profileData } = await supabase
        .from('profiles').select('nombre_completo').eq('id', id).single();

      let cobradorData = null;
      if (clienteData?.cobrador_asignado_id) {
        const { data: cob } = await supabase
          .from('profiles')
          .select('nombre_completo, telefono, email, avatar_url')
          .eq('id', clienteData.cobrador_asignado_id)
          .single();
        cobradorData = cob;
      }

      setDatos({ ...clienteData, creditos: creditosData || [], profiles: profileData, cobrador: cobradorData });
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem('cliente_id');
    if (!id) { router.push('/login'); return; }
    setClienteId(id);
    cargarDatos(id);

    // postgres_changes: funciona si la tabla tiene Realtime habilitado en Supabase
    const chPg = supabase
      .channel(`cliente-pagos-rt-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagos_diarios' }, () => {
        setPagoReciente(true);
        setTimeout(() => setPagoReciente(false), 4000);
        cargarDatos(id);
      })
      .subscribe();

    // Broadcast: el API envía esto al aprobar → no depende de RLS ni publicación
    const chBc = supabase
      .channel(`pagos-cliente-${id}`)
      .on('broadcast', { event: 'pago_aprobado' }, () => {
        setPagoReciente(true);
        setTimeout(() => setPagoReciente(false), 4000);
        cargarDatos(id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chPg);
      supabase.removeChannel(chBc);
    };
  }, [router, cargarDatos]);

  // Set calendar to the month of first pending payment once data loads
  useEffect(() => {
    if (!datos) return;
    const cred = (datos.creditos || [])[tabActivo] || (datos.creditos || [])[0];
    if (!cred) return;
    const prox = cred.pagos_diarios?.find((p: any) => !p.pagado);
    if (prox?.fecha_esperada) {
      const d = new Date(prox.fecha_esperada + 'T00:00:00');
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    }
  }, [datos?.id, tabActivo]);

  const handleTransferSubmit = async () => {
    if (!transferFile || !credito) return;
    if (transferFile.size > 20 * 1024 * 1024) { setTransferError('El archivo es muy grande (máx 20 MB).'); return; }
    setTransferLoading(true);
    setTransferError('');
    try {
      const id = localStorage.getItem('cliente_id');
      if (!id) throw new Error('No autenticado');
      const fileToSend = transferFile.type.startsWith('image/') ? await compressImage(transferFile) : transferFile;
      const fd = new FormData();
      fd.append('cliente_id', id);
      fd.append('credito_id', credito.id);
      if (proximoPendiente?.id) fd.append('pago_id', proximoPendiente.id);
      fd.append('monto', String(Math.round(credito.monto_diario) + moraTotal));
      fd.append('comprobante', fileToSend);
      const res = await fetch('/api/transferencias/crear', { method: 'POST', body: fd });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al enviar'); }
      setTransferSuccess(true);
      setTransferFile(null);
    } catch (e: any) {
      setTransferError(e.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const cerrarSesion = () => { localStorage.removeItem('cliente_id'); router.push('/login'); };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Cargando tu cuenta...</p>
      </div>
    );
  }

  const creditos = datos?.creditos || [];
  const credito = creditos[tabActivo] || creditos[0];
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const cronograma = credito
    ? [...(credito.pagos_diarios || [])]
        .sort((a: any, b: any) => a.numero_dia - b.numero_dia)
        .map((pago: any, i: number) => {
          const fechaPago = new Date(pago.fecha_esperada + 'T00:00:00');
          fechaPago.setHours(0, 0, 0, 0);
          return {
            id: pago.id,
            numero: i + 1,
            fecha: fechaPago.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' }),
            fechaRaw: pago.fecha_esperada as string,
            monto: credito.monto_diario,
            pagado: !!pago.pagado,
            mora: pago.mora ?? 0,
            atrasado: !pago.pagado && fechaPago < hoy,
          };
        })
    : [];

  const pagosPagados = cronograma.filter(p => p.pagado).length;
  const pagosPendientes = cronograma.length - pagosPagados;
  const porcentaje = cronograma.length > 0 ? Math.round((pagosPagados / cronograma.length) * 100) : 0;
  const pagosAtrasados = cronograma.filter(p => p.atrasado);
  const moraTotal = diasDeMora(credito?.pagos_diarios || []) * MORA_POR_DIA;
  const proximoPendiente = cronograma.find(p => !p.pagado);
  const totalAPagar = credito ? credito.monto_total + (credito.interes_total || 0) : 0;
  const totalPagado = pagosPagados * Math.round(credito?.monto_diario || 0);

  // Calendar
  const pagosPorFecha = new Map(cronograma.map(p => [p.fechaRaw, p]));
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const calGrid: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const pad = (n: number) => String(n).padStart(2, '0');
  const toDateStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const todayStr = new Date().toISOString().split('T')[0];
  const calDiaPago = calDia ? pagosPorFecha.get(calDia) : null;

  // Historial
  const histItems = cronograma.filter(p => {
    if (filtroHist === 'pagados') return p.pagado;
    if (filtroHist === 'pendientes') return !p.pagado && !p.atrasado;
    if (filtroHist === 'atrasados') return p.atrasado;
    return true;
  });

  // Cobrador WhatsApp
  const cobrador = datos?.cobrador;
  const nombreCliente = datos?.profiles?.nombre_completo || 'su cliente';
  const waNum = cobrador?.telefono ? formatWA(cobrador.telefono) : '';
  const waMsg = encodeURIComponent(`Hola ${cobrador?.nombre_completo || ''}, soy ${nombreCliente} de CrediCabs. Quisiera hablar sobre mi crédito.`);
  const waUrl = `https://wa.me/${waNum}?text=${waMsg}`;

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col">

      {/* Header sticky */}
      <header className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Mi Crédito</p>
            <h1 className="text-base font-black text-white leading-tight">
              {datos?.profiles?.nombre_completo || 'Cliente'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {pagoReciente && (
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-900/40 border border-emerald-800/50 px-2 py-1 rounded-full">
                ✓ Pago registrado
              </span>
            )}
            <NotifBell filterId={clienteId ?? undefined} storageKey="notif_seen_cliente" />
            <button
              onClick={cerrarSesion}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-700 text-gray-400 active:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {creditos.length > 1 && (
          <div className="flex gap-1 mt-2 -mb-px">
            {creditos.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => setTabActivo(i)}
                className={`px-3 py-1 text-xs font-bold rounded-t-lg border-b-2 transition-colors ${
                  tabActivo === i ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-gray-500'
                }`}
              >
                Crédito {i + 1}
              </button>
            ))}
          </div>
        )}
      </header>

      {creditos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-4xl">📋</p>
          <p className="text-white font-bold">Sin créditos activos</p>
          <p className="text-gray-500 text-sm">No tienes ningún crédito registrado.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-28">

          {/* ══════════════ INICIO ══════════════ */}
          {navTab === 'inicio' && (
            <div className="px-4 pt-4 space-y-3">

              {pagosAtrasados.length > 0 && (
                <div className="bg-red-950/60 border border-red-700/50 rounded-2xl p-4 space-y-2">
                  <p className="text-red-400 font-black text-sm">⚠️ {pagosAtrasados.length} pago{pagosAtrasados.length > 1 ? 's' : ''} atrasado{pagosAtrasados.length > 1 ? 's' : ''}</p>
                  {pagosAtrasados.slice(0, 3).map(p => (
                    <div key={p.numero} className="flex justify-between items-center bg-red-900/30 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-red-300 text-xs font-bold">Pago {p.numero}</p>
                        <p className="text-red-400 text-[10px]">{p.fecha}</p>
                      </div>
                      <p className="text-red-400 font-black text-sm">${Math.round(p.monto).toLocaleString('es-MX')}</p>
                    </div>
                  ))}
                  {pagosAtrasados.length > 3 && (
                    <p className="text-red-500 text-xs text-center">+{pagosAtrasados.length - 3} más atrasados</p>
                  )}
                  <p className="text-red-300 text-xs font-bold pt-1 border-t border-red-800/40">
                    Total atrasado: ${pagosAtrasados.reduce((s, p) => s + p.monto, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              )}

              {/* Resumen crédito */}
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Crédito</p>
                    <p className="text-white font-black text-2xl">${credito.monto_total.toLocaleString('es-MX')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Cuota diaria</p>
                    <p className="text-yellow-400 font-black text-2xl">${Math.round(credito.monto_diario).toLocaleString('es-MX')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-800/60 rounded-xl p-2.5">
                    <p className="text-gray-500 uppercase mb-0.5">Esquema</p>
                    <p className="text-white font-bold">{credito.semanas_autorizadas} pagos diarios</p>
                  </div>
                  <div className="bg-gray-800/60 rounded-xl p-2.5">
                    <p className="text-gray-500 uppercase mb-0.5">Total a pagar</p>
                    <p className="text-white font-bold">${totalAPagar.toLocaleString('es-MX')}</p>
                  </div>
                </div>
              </div>

              {/* Cobrador mini */}
              {cobrador && (
                <button
                  onClick={() => setNavTab('cobrador')}
                  className="w-full bg-gray-900 rounded-2xl border border-gray-800 p-4 flex items-center justify-between active:bg-gray-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden bg-red-600 flex items-center justify-center">
                      {cobrador.avatar_url
                        ? <img src={cobrador.avatar_url} alt={cobrador.nombre_completo} className="w-full h-full object-cover" />
                        : <span className="text-white font-black text-base">{cobrador.nombre_completo?.[0]?.toUpperCase() || 'C'}</span>
                      }
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Tu Cobrador</p>
                      <p className="text-white font-bold text-sm leading-tight">{cobrador.nombre_completo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <i className="fa-solid fa-phone text-green-500 text-sm" />
                    <i className="fa-solid fa-chevron-right text-xs" />
                  </div>
                </button>
              )}

              {/* Progreso */}
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-white font-bold text-sm">Progreso</p>
                  <span className="text-yellow-400 font-black text-lg">{porcentaje}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-700"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-xl p-3 text-center">
                    <p className="text-emerald-400 text-[10px] font-bold uppercase">Realizados</p>
                    <p className="text-emerald-300 font-black text-2xl">{pagosPagados}</p>
                  </div>
                  <div className="bg-red-950/40 border border-red-900/40 rounded-xl p-3 text-center">
                    <p className="text-red-400 text-[10px] font-bold uppercase">Pendientes</p>
                    <p className="text-red-300 font-black text-2xl">{pagosPendientes}</p>
                  </div>
                </div>

                {proximoPendiente && (
                  <div className={`rounded-xl p-3 ${proximoPendiente.atrasado ? 'bg-red-950/30 border border-red-800/40' : 'bg-blue-950/30 border border-blue-800/40'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`text-[10px] uppercase font-bold ${proximoPendiente.atrasado ? 'text-red-400' : 'text-blue-400'}`}>
                          {proximoPendiente.atrasado ? 'Pago atrasado' : 'Próximo pago'}
                        </p>
                        <p className="text-white font-black text-base">${Math.round(proximoPendiente.monto).toLocaleString('es-MX')}</p>
                        <p className="text-gray-400 text-[10px]">{proximoPendiente.fecha}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${proximoPendiente.atrasado ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        #{proximoPendiente.numero}
                      </span>
                    </div>
                    {moraTotal > 0 && (
                      <div className="mt-2 pt-2 border-t border-red-800/40 flex justify-between items-center">
                        <div>
                          <p className="text-red-400 text-[10px] font-bold uppercase">Mora acumulada</p>
                          <p className="text-red-300 text-[10px]">{pagosAtrasados.length} día{pagosAtrasados.length !== 1 ? 's' : ''} × $50</p>
                        </div>
                        <div className="text-right">
                          <p className="text-red-400 font-bold">+${moraTotal.toLocaleString('es-MX')}</p>
                          <p className="text-white font-black text-sm">Total: ${(Math.round(proximoPendiente.monto) + moraTotal).toLocaleString('es-MX')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pagar por Transferencia */}
              {credito && proximoPendiente && (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                  <button
                    onClick={() => { setTransferShow(!transferShow); setTransferSuccess(false); setTransferError(''); }}
                    className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-building-columns text-blue-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-white font-bold text-sm">Pagar por Transferencia</p>
                        <p className="text-gray-500 text-[10px]">Envía tu comprobante al administrador</p>
                      </div>
                    </div>
                    <i className={`fa-solid fa-chevron-${transferShow ? 'up' : 'down'} text-gray-500 text-sm`} />
                  </button>

                  {transferShow && (
                    <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                      {transferSuccess ? (
                        <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-5 text-center">
                          <i className="fa-solid fa-circle-check text-emerald-400 text-3xl mb-2" />
                          <p className="text-emerald-300 font-bold text-sm">¡Comprobante enviado!</p>
                          <p className="text-gray-400 text-xs mt-1">El administrador revisará y aprobará tu pago pronto.</p>
                          <button
                            onClick={() => { setTransferSuccess(false); setTransferFile(null); setTransferError(''); }}
                            className="mt-3 text-xs text-gray-500 underline"
                          >
                            Enviar otro comprobante
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className={`rounded-xl p-3 ${moraTotal > 0 ? 'bg-red-950/30 border border-red-800/40' : 'bg-blue-950/30 border border-blue-800/40'}`}>
                            <p className={`text-[10px] font-bold uppercase mb-1 ${moraTotal > 0 ? 'text-red-400' : 'text-blue-400'}`}>Este comprobante cubre</p>
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-white font-bold text-sm">Pago #{proximoPendiente.numero}</p>
                                <p className="text-gray-400 text-[10px]">{proximoPendiente.fecha}</p>
                              </div>
                              <p className={`font-black text-lg ${moraTotal > 0 ? 'text-red-300' : 'text-blue-300'}`}>
                                ${Math.round(proximoPendiente.monto).toLocaleString('es-MX')}
                              </p>
                            </div>
                            {moraTotal > 0 && (
                              <div className="mt-2 pt-2 border-t border-red-800/40 flex justify-between items-center">
                                <p className="text-red-400 text-[10px] font-bold">+ Mora ({pagosAtrasados.length} día{pagosAtrasados.length !== 1 ? 's' : ''})</p>
                                <div className="text-right">
                                  <p className="text-red-400 text-xs font-bold">+${moraTotal.toLocaleString('es-MX')}</p>
                                  <p className="text-white font-black text-sm">Total: ${(Math.round(proximoPendiente.monto) + moraTotal).toLocaleString('es-MX')}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-gray-400 text-xs font-medium block mb-1.5">Comprobante de transferencia</label>
                            <label className={`flex flex-col items-center justify-center gap-2 w-full py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                              transferFile ? 'border-emerald-500 bg-emerald-950/20' : 'border-gray-700 bg-gray-800/40'
                            }`}>
                              <i className={`fa-solid ${transferFile ? 'fa-circle-check text-emerald-400' : 'fa-image text-gray-500'} text-2xl`} />
                              <span className="text-xs text-gray-400 text-center px-2 break-all">
                                {transferFile ? transferFile.name : 'Toca para seleccionar foto o PDF'}
                              </span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*,application/pdf"
                                onChange={e => { setTransferFile(e.target.files?.[0] || null); setTransferError(''); }}
                              />
                            </label>
                          </div>

                          {transferError && (
                            <p className="text-red-400 text-xs bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">{transferError}</p>
                          )}

                          <button
                            onClick={handleTransferSubmit}
                            disabled={!transferFile || transferLoading}
                            className="w-full py-3 bg-blue-600 active:bg-blue-700 text-white font-bold rounded-xl text-sm disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                          >
                            {transferLoading ? (
                              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
                            ) : (
                              <><i className="fa-solid fa-paper-plane" />Enviar comprobante</>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════ HISTORIAL ══════════════ */}
          {navTab === 'historial' && (
            <div className="px-4 pt-4 space-y-3">

              {/* Stats rápidas */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-2xl p-3 text-center">
                  <p className="text-emerald-400 text-[9px] font-bold uppercase">Pagados</p>
                  <p className="text-emerald-300 font-black text-xl">{pagosPagados}</p>
                  <p className="text-emerald-600 text-[9px]">${totalPagado.toLocaleString('es-MX')}</p>
                </div>
                <div className="bg-gray-800/60 border border-gray-700/40 rounded-2xl p-3 text-center">
                  <p className="text-gray-400 text-[9px] font-bold uppercase">Pendientes</p>
                  <p className="text-white font-black text-xl">{pagosPendientes - pagosAtrasados.length}</p>
                  <p className="text-gray-600 text-[9px]">por vencer</p>
                </div>
                <div className="bg-red-950/40 border border-red-900/40 rounded-2xl p-3 text-center">
                  <p className="text-red-400 text-[9px] font-bold uppercase">Atrasados</p>
                  <p className="text-red-300 font-black text-xl">{pagosAtrasados.length}</p>
                  <p className="text-red-600 text-[9px]">${(pagosAtrasados.length * 50).toLocaleString('es-MX')} mora</p>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {(['todos', 'pagados', 'pendientes', 'atrasados'] as FiltroHist[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFiltroHist(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                      filtroHist === f
                        ? f === 'todos' ? 'bg-gray-600 text-white'
                          : f === 'pagados' ? 'bg-emerald-700 text-white'
                          : f === 'pendientes' ? 'bg-blue-700 text-white'
                          : 'bg-red-700 text-white'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {f === 'todos' ? 'Todos' : f === 'pagados' ? 'Pagados' : f === 'pendientes' ? 'Por vencer' : 'Atrasados'}
                    <span className="ml-1.5 opacity-70">
                      {f === 'todos' ? cronograma.length
                        : f === 'pagados' ? pagosPagados
                        : f === 'pendientes' ? pagosPendientes - pagosAtrasados.length
                        : pagosAtrasados.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Lista */}
              {histItems.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                  <p className="text-gray-500 text-sm">Sin pagos en esta categoría</p>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden divide-y divide-gray-800/60">
                  {histItems.map(item => (
                    <div
                      key={item.numero}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        item.pagado ? 'bg-emerald-950/10' : item.atrasado ? 'bg-red-950/15' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border shrink-0 ${
                        item.pagado
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                          : item.atrasado
                          ? 'border-red-500 bg-red-500/20 text-red-400'
                          : 'border-gray-700 bg-gray-800 text-gray-400'
                      }`}>
                        {item.pagado ? <i className="fa-solid fa-check text-[10px]" /> : item.atrasado ? '!' : item.numero}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-bold ${item.pagado ? 'text-emerald-400' : item.atrasado ? 'text-red-300' : 'text-white'}`}>
                            Pago {item.numero}
                          </p>
                          {item.pagado && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded-full font-bold">PAGADO</span>
                          )}
                          {item.atrasado && (
                            <span className="text-[9px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded-full font-bold">ATRASADO</span>
                          )}
                        </div>
                        <p className={`text-[10px] ${item.atrasado ? 'text-red-500' : 'text-gray-500'}`}>{item.fecha}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-sm font-black ${
                          item.pagado ? 'text-emerald-400' : item.atrasado ? 'text-red-400' : 'text-yellow-500'
                        }`}>
                          ${Math.round(item.monto).toLocaleString('es-MX')}
                        </p>
                        {item.atrasado && (
                          <p className="text-[9px] text-red-500 font-bold">+$50 mora</p>
                        )}
                        {item.pagado && item.mora > 0 && (
                          <p className="text-[9px] text-red-400">mora: ${item.mora}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════ CALENDARIO ══════════════ */}
          {navTab === 'calendario' && (
            <div className="px-4 pt-4 space-y-4">

              {/* Month nav */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setCalDia(null);
                    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                    else setCalMonth(m => m - 1);
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 active:bg-gray-700 transition-colors"
                >
                  <i className="fa-solid fa-chevron-left text-sm" />
                </button>
                <p className="text-white font-black text-lg">{MESES_ES[calMonth]} {calYear}</p>
                <button
                  onClick={() => {
                    setCalDia(null);
                    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                    else setCalMonth(m => m + 1);
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 active:bg-gray-700 transition-colors"
                >
                  <i className="fa-solid fa-chevron-right text-sm" />
                </button>
              </div>

              {/* Grid */}
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-3">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DIAS_ES.map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-gray-500 py-1">{d}</div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-y-1">
                  {calGrid.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const dateStr = toDateStr(calYear, calMonth, day);
                    const pago = pagosPorFecha.get(dateStr);
                    const isToday = dateStr === todayStr;
                    const isSelected = calDia === dateStr;

                    return (
                      <button
                        key={i}
                        onClick={() => pago ? setCalDia(isSelected ? null : dateStr) : undefined}
                        disabled={!pago}
                        className={`relative flex flex-col items-center justify-center rounded-xl py-1.5 transition-all ${
                          isSelected
                            ? pago?.pagado ? 'bg-emerald-600' : pago?.atrasado ? 'bg-red-600' : 'bg-yellow-500'
                            : pago
                            ? 'active:bg-gray-700'
                            : ''
                        }`}
                      >
                        <span className={`text-xs font-bold leading-none ${
                          isSelected ? 'text-white'
                          : isToday ? 'text-yellow-400'
                          : pago ? pago.pagado ? 'text-emerald-300' : pago.atrasado ? 'text-red-300' : 'text-white'
                          : 'text-gray-600'
                        }`}>
                          {day}
                        </span>
                        {pago && !isSelected && (
                          <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                            pago.pagado ? 'bg-emerald-400' : pago.atrasado ? 'bg-red-400' : 'bg-yellow-400'
                          }`} />
                        )}
                        {isToday && !isSelected && (
                          <span className="absolute inset-0 rounded-xl ring-1 ring-yellow-400 pointer-events-none" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day detail */}
              {calDiaPago && (
                <div className={`rounded-2xl p-4 border ${
                  calDiaPago.pagado
                    ? 'bg-emerald-950/40 border-emerald-800/50'
                    : calDiaPago.atrasado
                    ? 'bg-red-950/40 border-red-800/50'
                    : 'bg-blue-950/40 border-blue-800/50'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-[10px] font-bold uppercase ${
                        calDiaPago.pagado ? 'text-emerald-400' : calDiaPago.atrasado ? 'text-red-400' : 'text-blue-400'
                      }`}>
                        {calDiaPago.pagado ? 'Pago realizado' : calDiaPago.atrasado ? 'Pago atrasado' : 'Pago próximo'}
                      </p>
                      <p className="text-white font-black text-xl mt-0.5">${Math.round(calDiaPago.monto).toLocaleString('es-MX')}</p>
                      <p className="text-gray-400 text-xs">{calDiaPago.fecha} · Pago #{calDiaPago.numero}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      calDiaPago.pagado ? 'bg-emerald-500/20' : calDiaPago.atrasado ? 'bg-red-500/20' : 'bg-blue-500/20'
                    }`}>
                      <i className={`fa-solid text-lg ${
                        calDiaPago.pagado ? 'fa-check text-emerald-400' : calDiaPago.atrasado ? 'fa-triangle-exclamation text-red-400' : 'fa-clock text-blue-400'
                      }`} />
                    </div>
                  </div>
                  {calDiaPago.atrasado && (
                    <p className="text-red-400 text-xs mt-2 pt-2 border-t border-red-800/40 font-bold">
                      +$50 mora por día de atraso
                    </p>
                  )}
                </div>
              )}

              {/* Leyenda */}
              <div className="flex gap-4 justify-center pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-gray-500">Pagado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="text-[10px] text-gray-500">Atrasado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span className="text-[10px] text-gray-500">Próximo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full ring-1 ring-yellow-400" />
                  <span className="text-[10px] text-gray-500">Hoy</span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ COBRADOR ══════════════ */}
          {navTab === 'cobrador' && (
            <div className="px-4 pt-8 flex flex-col items-center gap-5">
              {cobrador ? (
                <>
                  {/* Avatar grande */}
                  <div className="w-24 h-24 rounded-full overflow-hidden shadow-2xl shadow-red-900/50 border-4 border-gray-700 shrink-0">
                    {cobrador.avatar_url ? (
                      <img
                        src={cobrador.avatar_url}
                        alt={cobrador.nombre_completo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                        <span className="text-white font-black text-4xl">
                          {cobrador.nombre_completo?.[0]?.toUpperCase() || 'C'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-white font-black text-2xl leading-tight">{cobrador.nombre_completo}</p>
                    <p className="text-gray-500 text-sm mt-1">Tu cobrador asignado</p>
                  </div>

                  {/* Botones de acción */}
                  <div className="w-full max-w-xs space-y-3">
                    {cobrador.telefono && (
                      <>
                        <a
                          href={`tel:${cobrador.telefono}`}
                          className="w-full flex items-center justify-center gap-3 bg-emerald-700 active:bg-emerald-800 text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-lg shadow-emerald-900/30"
                        >
                          <i className="fa-solid fa-phone text-lg" />
                          Llamar
                        </a>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-3 bg-[#25D366] active:bg-[#1ebe5c] text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-lg shadow-green-900/30"
                        >
                          <i className="fa-brands fa-whatsapp text-xl" />
                          WhatsApp
                        </a>
                      </>
                    )}
                  </div>

                  {/* Info de contacto */}
                  {cobrador.telefono && (
                    <div className="w-full max-w-xs bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <i className="fa-solid fa-phone text-gray-500 w-4 text-center" />
                        <p className="text-white text-sm font-medium">{cobrador.telefono}</p>
                      </div>
                      <div className="flex items-start gap-3 pt-2 border-t border-gray-800">
                        <i className="fa-solid fa-circle-info text-gray-500 w-4 text-center mt-0.5" />
                        <p className="text-gray-400 text-xs leading-relaxed">
                          Tu cobrador pasará a recoger tu pago según tu horario acordado. Si tienes alguna duda o necesitas reagendar, contáctalo directamente.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 py-12 text-center px-6">
                  <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center">
                    <i className="fa-solid fa-user-slash text-gray-600 text-3xl" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">Sin cobrador asignado</p>
                    <p className="text-gray-500 text-sm mt-1">Contacta a la oficina para más información.</p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Bottom Nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-gray-900/95 backdrop-blur-md border-t border-gray-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          <NavBtn
            icon="fa-house"
            label="Inicio"
            active={navTab === 'inicio'}
            onClick={() => setNavTab('inicio')}
          />
          <NavBtn
            icon="fa-rectangle-list"
            label="Historial"
            active={navTab === 'historial'}
            badge={pagosAtrasados.length > 0 ? pagosAtrasados.length : undefined}
            onClick={() => setNavTab('historial')}
          />
          <NavBtn
            icon="fa-calendar-days"
            label="Calendario"
            active={navTab === 'calendario'}
            onClick={() => setNavTab('calendario')}
          />
          <NavBtn
            icon="fa-headset"
            label="Cobrador"
            active={navTab === 'cobrador'}
            onClick={() => setNavTab('cobrador')}
          />
        </div>
      </nav>

    </main>
  );
}
