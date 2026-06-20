'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { NotifBell } from '../../components/NotifBell';
import { diasDeMora, MORA_POR_DIA } from '../../lib/mora';

// Compresses an image to max 1400px and JPEG 82% before upload (~10-20x smaller)
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
  const router = useRouter();

  const cargarDatos = useCallback(async (id: string) => {
    try {
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes').select('*').eq('id', id).single();
      if (clienteError) throw clienteError;

      const { data: creditosData, error: creditosError } = await supabase
        .from('creditos').select('*, pagos_diarios(*)').eq('cliente_id', id);
      if (creditosError) throw creditosError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('nombre_completo').eq('id', id).single();
      if (profileError) throw profileError;

      let cobradorData = null;
      if (clienteData?.cobrador_asignado_id) {
        const { data: cob } = await supabase
          .from('profiles')
          .select('nombre_completo, telefono')
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

    const channel = supabase
      .channel(`cliente-pagos-rt-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagos_diarios' }, () => {
        setPagoReciente(true);
        setTimeout(() => setPagoReciente(false), 4000);
        cargarDatos(id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [router, cargarDatos]);

  const handleTransferSubmit = async () => {
    if (!transferFile || !credito) return;
    if (transferFile.size > 20 * 1024 * 1024) {
      setTransferError('El archivo es muy grande (máx 20 MB).');
      return;
    }
    setTransferLoading(true);
    setTransferError('');
    try {
      const clienteId = localStorage.getItem('cliente_id');
      if (!clienteId) throw new Error('No autenticado');

      // Compress before upload: typical 5 MB photo → ~300 KB
      const fileToSend = transferFile.type.startsWith('image/')
        ? await compressImage(transferFile)
        : transferFile;

      const fd = new FormData();
      fd.append('cliente_id', clienteId);
      fd.append('credito_id', credito.id);
      if (proximoPendiente?.id) fd.append('pago_id', proximoPendiente.id);
      fd.append('monto', String(Math.round(credito.monto_diario) + moraTotal));
      fd.append('comprobante', fileToSend);
      const res = await fetch('/api/transferencias/crear', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al enviar');
      }
      setTransferSuccess(true);
      setTransferFile(null);
    } catch (e: any) {
      setTransferError(e.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('cliente_id');
    router.push('/login');
  };

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

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

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
            monto: credito.monto_diario,
            pagado: !!pago.pagado,
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

        {/* Tabs si hay varios créditos */}
        {creditos.length > 1 && (
          <div className="flex gap-1 mt-2 -mb-px">
            {creditos.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => setTabActivo(i)}
                className={`px-3 py-1 text-xs font-bold rounded-t-lg border-b-2 transition-colors ${
                  tabActivo === i
                    ? 'border-yellow-500 text-yellow-400'
                    : 'border-transparent text-gray-500'
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
        <div className="flex-1 overflow-y-auto pb-10">
          <div className="px-4 pt-4 space-y-3">

            {/* Alerta de pagos atrasados */}
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

            {/* Resumen del crédito */}
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

            {/* Tu cobrador */}
            {datos?.cobrador && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">Tu Cobrador</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-base shrink-0">
                      {datos.cobrador.nombre_completo?.[0]?.toUpperCase() || 'C'}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm leading-tight">{datos.cobrador.nombre_completo}</p>
                      <p className="text-gray-500 text-[10px]">Cobrador asignado</p>
                    </div>
                  </div>
                  {datos.cobrador.telefono && (
                    <a
                      href={`tel:${datos.cobrador.telefono}`}
                      className="w-9 h-9 bg-green-900/40 border border-green-800/50 rounded-full flex items-center justify-center text-green-400 active:bg-green-900/70 transition-colors"
                      title={`Llamar a ${datos.cobrador.nombre_completo}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
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
                <div className={`rounded-xl p-3 ${
                  proximoPendiente.atrasado
                    ? 'bg-red-950/30 border border-red-800/40'
                    : 'bg-blue-950/30 border border-blue-800/40'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-[10px] uppercase font-bold ${proximoPendiente.atrasado ? 'text-red-400' : 'text-blue-400'}`}>
                        {proximoPendiente.atrasado ? 'Pago atrasado' : 'Próximo pago'}
                      </p>
                      <p className="text-white font-black text-base">${Math.round(proximoPendiente.monto).toLocaleString('es-MX')}</p>
                      <p className="text-gray-400 text-[10px]">{proximoPendiente.fecha}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      proximoPendiente.atrasado ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
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
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-paper-plane" />
                              Enviar comprobante
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Calendario de pagos */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                <p className="text-white font-bold text-sm">Calendario de Pagos</p>
                <p className="text-gray-500 text-[10px]">{cronograma.length} días hábiles</p>
              </div>
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-800/60">
                {cronograma.map((item) => (
                  <div
                    key={item.numero}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      item.pagado ? 'bg-emerald-950/10' : item.atrasado ? 'bg-red-950/15' : ''
                    }`}
                  >
                    {/* Indicador */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
                      item.pagado
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : item.atrasado
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-gray-700 text-gray-500'
                    }`}>
                      {item.pagado ? '✓' : item.atrasado ? '!' : item.numero}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${item.pagado ? 'text-emerald-400' : item.atrasado ? 'text-red-300' : 'text-white'}`}>
                        Pago {item.numero}
                      </p>
                      <p className={`text-[10px] ${item.atrasado ? 'text-red-500' : 'text-gray-500'}`}>{item.fecha}</p>
                    </div>

                    {/* Monto */}
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black ${
                        item.pagado ? 'text-emerald-400' : item.atrasado ? 'text-red-400' : 'text-yellow-500'
                      }`}>
                        ${Math.round(item.monto).toLocaleString('es-MX')}
                      </p>
                      {item.atrasado && (
                        <p className="text-[9px] text-red-500 font-bold">+$50 mora</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
