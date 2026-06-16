'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import UserNav from '../../components/UserNav';
import { InterestBreakdown } from '../../components/InterestBreakdown';
import { LumaSpin } from '../../components/luma-spin';
import { ImageLightbox } from '../../components/ImageLightbox';

export default function BandejaPage() {
  const [bandejaTab, setBandejaTab] = useState<'prospectos' | 'transferencias'>('prospectos');

  // ── Prospectos ──────────────────────────────────────────────
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [cobradores, setCobradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSolicitud, setSelectedSolicitud] = useState<any | null>(null);
  const [formData, setFormData] = useState({ monto: 5000, semanas: 28, tasa_interes: 40, cobrador_id: '' });
  const [procesando, setProcesando] = useState(false);
  const [mobileTab, setMobileTab] = useState<'expediente' | 'configurar'>('expediente');
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  // ── Transferencias ──────────────────────────────────────────
  const [transferencias, setTransferencias] = useState<any[]>([]);
  const [loadingTrans, setLoadingTrans] = useState(false);
  const [selectedTrans, setSelectedTrans] = useState<any | null>(null);
  const [procesandoTrans, setProcesandoTrans] = useState(false);
  const [transLightbox, setTransLightbox] = useState(false);
  const [transImgLoaded, setTransImgLoaded] = useState(false);

  useEffect(() => {
    cargarDatos();
    cargarTransferencias();

    const uid = Math.random().toString(36).slice(2);

    const chSol = supabase
      .channel(`bandeja_sol_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes' }, cargarDatos)
      .subscribe();

    const chTrans = supabase
      .channel(`bandeja_trans_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transferencias' }, cargarTransferencias)
      .subscribe();

    return () => {
      supabase.removeChannel(chSol);
      supabase.removeChannel(chTrans);
    };
  }, []);

  useEffect(() => {
    if (selectedSolicitud) setMobileTab('expediente');
  }, [selectedSolicitud?.id]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [solRes, cobRes] = await Promise.all([
        supabase.from('solicitudes').select('*').eq('estado', 'pendiente').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, nombre_completo').eq('rol', 'cobrador'),
      ]);
      if (solRes.data) setSolicitudes(solRes.data);
      if (cobRes.data) setCobradores(cobRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const cargarTransferencias = async () => {
    setLoadingTrans(true);
    try {
      const { data: transData } = await supabase
        .from('transferencias')
        .select('*, creditos(monto_diario)')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false });

      if (transData && transData.length > 0) {
        const ids = [...new Set(transData.map((t: any) => t.cliente_id))];
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, nombre_completo')
          .in('id', ids);
        const profMap = new Map((profData || []).map((p: any) => [p.id, p]));
        setTransferencias(transData.map((t: any) => ({
          ...t,
          cliente_nombre: profMap.get(t.cliente_id)?.nombre_completo || 'Cliente',
        })));
      } else {
        setTransferencias([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingTrans(false);
    }
  };

  const handleAprobar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cobrador_id) {
      alert('⚠️ Por favor, selecciona un cobrador de la lista antes de aprobar.');
      return;
    }
    setProcesando(true);
    try {
      if (!selectedSolicitud) return;
      const tasaPorcentaje = parseFloat(formData.tasa_interes?.toString() || '0');
      const res = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: selectedSolicitud.nombre_prospecto,
          email: `cliente_${Date.now()}@credicabs.com`,
          telefono: selectedSolicitud.telefono || '',
          direccion: selectedSolicitud.direccion || '',
          monto_total: formData.monto,
          semanas_autorizadas: formData.semanas,
          tasa_interes_porcentaje: tasaPorcentaje,
          cobrador_asignado_id: formData.cobrador_id,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al crear cliente');
      }
      await supabase.from('solicitudes').update({ estado: 'aprobado' }).eq('id', selectedSolicitud.id);

      // Notify asesor
      if (selectedSolicitud.asesor_id) {
        supabase.from('notificaciones').insert({
          destinatario_id: selectedSolicitud.asesor_id,
          titulo: '¡Solicitud aprobada! ✓',
          mensaje: `${selectedSolicitud.nombre_prospecto} fue aprobado y convertido en cliente.`,
          tipo: 'pago',
        }).then(() => {});
      }

      alert('¡Prospecto aprobado! Se ha convertido en cliente y su calendario de pagos está listo.');
      setSelectedSolicitud(null);
      cargarDatos();
    } catch (error: any) {
      alert('Error al aprobar: ' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async (id: string) => {
    if (!confirm('¿Estás seguro de rechazar esta solicitud?')) return;
    try {
      await supabase.from('solicitudes').update({ estado: 'rechazado' }).eq('id', id);

      // Notify asesor
      if (selectedSolicitud?.asesor_id) {
        supabase.from('notificaciones').insert({
          destinatario_id: selectedSolicitud.asesor_id,
          titulo: 'Solicitud rechazada',
          mensaje: `${selectedSolicitud.nombre_prospecto} no fue aprobado en esta ocasión.`,
          tipo: 'info',
        }).then(() => {});
      }

      setSelectedSolicitud(null);
      cargarDatos();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAprobarTransferencia = async () => {
    if (!selectedTrans) return;
    setProcesandoTrans(true);
    try {
      const res = await fetch('/api/transferencias/accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferenciaId: selectedTrans.id,
          pagoId: selectedTrans.pago_diario_id || null,
          accion: 'aprobar',
        }),
      });
      if (!res.ok) throw new Error('Error al aprobar');
      setSelectedTrans(null);
      setTransLightbox(false);
      setTransferencias(prev => prev.filter(t => t.id !== selectedTrans.id));
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setProcesandoTrans(false);
    }
  };

  const handleRechazarTransferencia = async () => {
    if (!selectedTrans || !confirm('¿Rechazar este comprobante?')) return;
    setProcesandoTrans(true);
    try {
      const res = await fetch('/api/transferencias/accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferenciaId: selectedTrans.id,
          pagoId: null,
          accion: 'rechazar',
        }),
      });
      if (!res.ok) throw new Error('Error al rechazar');
      setSelectedTrans(null);
      setTransLightbox(false);
      setTransferencias(prev => prev.filter(t => t.id !== selectedTrans.id));
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setProcesandoTrans(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 pb-20 md:p-8">
      {/* Header móvil sticky */}
      <header className="md:hidden sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-white leading-tight">Bandeja de <span className="text-red-600">Entrada</span></h1>
          <p className="text-gray-500 text-[9px] uppercase tracking-widest">Panel de Revisión</p>
        </div>
        <UserNav />
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-0">
        {/* Navegación desktop */}
        <nav className="hidden md:flex justify-between items-center border-b border-gray-800 py-4 mb-8">
          <div className="flex gap-4">
            <Link href="/" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Dashboard</Link>
            <Link href="/clientes" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Clientes</Link>
            <Link href="/equipo" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Equipo</Link>
            <Link href="/bandeja" className="px-5 py-2 border-b-2 border-red-600 text-white font-bold">Bandeja</Link>
          </div>
          <UserNav />
        </nav>

        {/* Header desktop */}
        <header className="hidden md:flex pt-0 pb-6 border-b border-red-900 justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-black text-white">Bandeja de <span className="text-red-600">Entrada</span></h1>
            <p className="text-gray-400 text-base tracking-widest uppercase">Panel de Revisión</p>
          </div>
        </header>

        {/* ── Tab switcher ── */}
        <div className="flex gap-2 mb-6 mt-3 md:mt-0">
          <button
            onClick={() => setBandejaTab('prospectos')}
            className={`flex-1 md:flex-none md:px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              bandejaTab === 'prospectos'
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-file-lines" />
            Prospectos
            {solicitudes.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {solicitudes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setBandejaTab('transferencias')}
            className={`flex-1 md:flex-none md:px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              bandejaTab === 'transferencias'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-building-columns" />
            Transferencias
            {transferencias.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {transferencias.length}
              </span>
            )}
          </button>
        </div>

        {/* ── PROSPECTOS ── */}
        {bandejaTab === 'prospectos' && (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4"><LumaSpin /></div>
            ) : solicitudes.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 p-10 rounded-xl text-center text-gray-500">
                No hay solicitudes pendientes por revisar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {solicitudes.map(sol => (
                  <div key={sol.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-yellow-500 transition-all flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-white">{sol.nombre_prospecto}</h3>
                      <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-1 rounded font-bold uppercase">Pendiente</span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-2 mb-4 flex-grow">
                      <p><i className="fa-solid fa-phone w-5 text-gray-500" /> {sol.telefono}</p>
                      <p><i className="fa-solid fa-briefcase w-5 text-gray-500" /> {sol.ocupacion}</p>
                      <p><i className="fa-solid fa-money-bill-wave w-5 text-green-500" /> Ingreso: <span className="text-white font-bold">${sol.ingreso_mensual}</span></p>
                      <p className="text-xs mt-2 border-t border-gray-800 pt-2">{sol.direccion}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedSolicitud(sol);
                        setFormData({ monto: 5000, semanas: 28, tasa_interes: 40, cobrador_id: '' });
                      }}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded font-bold transition-colors border border-gray-700"
                    >
                      Ver Expediente
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TRANSFERENCIAS ── */}
        {bandejaTab === 'transferencias' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-sm">Comprobantes de pago enviados por clientes</p>
              <button
                onClick={cargarTransferencias}
                className="text-gray-500 hover:text-blue-400 transition-colors p-1"
                title="Actualizar"
              >
                <i className="fa-solid fa-rotate text-sm" />
              </button>
            </div>

            {loadingTrans ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4"><LumaSpin /></div>
            ) : transferencias.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 p-10 rounded-xl text-center">
                <i className="fa-solid fa-building-columns text-gray-700 text-4xl mb-3 block" />
                <p className="text-gray-400 font-medium">Sin transferencias pendientes</p>
                <p className="text-gray-600 text-sm mt-1">Cuando un cliente envíe un comprobante aparecerá aquí.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {transferencias.map(trans => {
                  const fecha = new Date(trans.created_at).toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  });
                  const hora = new Date(trans.created_at).toLocaleTimeString('es-MX', {
                    hour: '2-digit', minute: '2-digit',
                  });
                  const cuota = trans.creditos?.monto_diario || 0;
                  const mora = cuota > 0 ? Math.max(0, Math.round(trans.monto) - Math.round(cuota)) : 0;
                  const diasAtraso = mora > 0 ? Math.round(mora / 50) : 0;
                  return (
                    <div key={trans.id} className={`bg-gray-900 border rounded-xl p-5 hover:border-opacity-80 transition-all flex flex-col gap-4 ${mora > 0 ? 'border-red-800/50 hover:border-red-600/60' : 'border-gray-800 hover:border-blue-500/50'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-bold text-base leading-tight">{trans.cliente_nombre}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{fecha} · {hora}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                            Pendiente
                          </span>
                          {mora > 0 && (
                            <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              +mora
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={`rounded-xl px-4 py-3 ${mora > 0 ? 'bg-red-950/30 border border-red-800/30' : 'bg-blue-950/30 border border-blue-800/30'}`}>
                        {mora > 0 ? (
                          <>
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-gray-400 text-[10px] uppercase font-bold">Cuota</p>
                              <p className="text-gray-300 font-bold text-sm">${Math.round(cuota).toLocaleString('es-MX')}</p>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-red-400 text-[10px] uppercase font-bold">Mora ({diasAtraso} día{diasAtraso !== 1 ? 's' : ''})</p>
                              <p className="text-red-400 font-bold text-sm">+${mora.toLocaleString('es-MX')}</p>
                            </div>
                            <div className="pt-1.5 border-t border-red-800/40 flex justify-between items-center">
                              <p className="text-red-300 text-[10px] uppercase font-bold">Total recibido</p>
                              <p className="text-white font-black text-xl">${Number(trans.monto).toLocaleString('es-MX')}</p>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-blue-400 text-[10px] uppercase font-bold">Monto</p>
                              <p className="text-white font-black text-xl">${Number(trans.monto).toLocaleString('es-MX')}</p>
                            </div>
                            <i className="fa-solid fa-receipt text-blue-700 text-2xl" />
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => { setSelectedTrans({ ...trans, _cuota: cuota, _mora: mora, _diasAtraso: diasAtraso }); setTransLightbox(false); setTransImgLoaded(false); }}
                        className={`w-full text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${mora > 0 ? 'bg-red-700 hover:bg-red-800 active:bg-red-900' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'}`}
                      >
                        <i className="fa-solid fa-image" />
                        Ver Comprobante
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL PROSPECTOS ─────────────────────────────────── */}
      {selectedSolicitud && (
        <>
          {lightbox && (
            <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
          )}

          <div
            className="hidden sm:block fixed inset-0 z-[109] bg-black/90 backdrop-blur-sm"
            onClick={() => setSelectedSolicitud(null)}
          />

          <div className="fixed inset-0 z-[110] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-4xl sm:rounded-2xl sm:border sm:border-red-900 sm:shadow-2xl bg-gray-950 flex flex-col overflow-hidden sm:max-h-[90vh]">

            {/* Header móvil con tabs */}
            <div
              className="sm:hidden shrink-0 bg-gray-950 border-b border-gray-800"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
              <div className="flex items-center justify-between px-4 pb-3">
                <button
                  onClick={() => setSelectedSolicitud(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-700 text-gray-400 active:bg-gray-800 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-lg" />
                </button>

                <div className="flex bg-gray-800/80 rounded-xl p-1 gap-0.5">
                  <button
                    onClick={() => setMobileTab('expediente')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      mobileTab === 'expediente' ? 'bg-yellow-500 text-black shadow' : 'text-gray-400'
                    }`}
                  >
                    Expediente
                  </button>
                  <button
                    onClick={() => setMobileTab('configurar')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      mobileTab === 'configurar' ? 'bg-red-600 text-white shadow' : 'text-gray-400'
                    }`}
                  >
                    Configurar
                  </button>
                </div>

                <span className="text-[10px] text-gray-600 max-w-[72px] truncate text-right leading-tight">
                  {selectedSolicitud.nombre_prospecto?.split(' ')[0]}
                </span>
              </div>
            </div>

            <div className="hidden sm:flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>

            <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">

              {/* Expediente */}
              <div
                className={`w-full sm:w-1/2 bg-gray-900 border-b sm:border-b-0 sm:border-r border-gray-800 overflow-y-auto
                  ${mobileTab === 'expediente' ? 'flex-1 min-h-0' : 'hidden sm:block sm:flex-none'}`}
              >
                <div className="p-4">
                  <h2 className="text-lg font-bold text-white mb-3 border-l-4 border-yellow-500 pl-2">
                    Expediente Digital
                  </h2>

                  {selectedSolicitud.ine_url && (
                    <div className="mb-4">
                      <p className="text-gray-400 text-[10px] uppercase mb-1.5 tracking-wide">Fotografía INE</p>
                      <button
                        type="button"
                        onClick={() => setLightbox({ src: selectedSolicitud.ine_url, alt: 'Foto INE Frente' })}
                        className="block w-full bg-gray-800 rounded-xl overflow-hidden border border-gray-700 active:opacity-70 hover:border-yellow-500/50 transition-all"
                      >
                        <img src={selectedSolicitud.ine_url} alt="INE" className="w-full max-h-56 object-contain" />
                      </button>
                      <p className="text-gray-600 text-[10px] mt-1 text-center">
                        <i className="fa-solid fa-magnifying-glass mr-1" />Toca para ampliar · Descargar
                      </p>
                    </div>
                  )}

                  {selectedSolicitud.comprobante_url && (
                    <div className="mb-4">
                      <p className="text-gray-400 text-[10px] uppercase mb-1.5 tracking-wide">Comprobante de Domicilio</p>
                      <button
                        type="button"
                        onClick={() => setLightbox({ src: selectedSolicitud.comprobante_url, alt: 'Comprobante de Domicilio' })}
                        className="block w-full bg-gray-800 rounded-xl overflow-hidden border border-gray-700 active:opacity-70 hover:border-yellow-500/50 transition-all"
                      >
                        <img src={selectedSolicitud.comprobante_url} alt="Comprobante" className="w-full max-h-56 object-contain" />
                      </button>
                      <p className="text-gray-600 text-[10px] mt-1 text-center">
                        <i className="fa-solid fa-magnifying-glass mr-1" />Toca para ampliar · Descargar
                      </p>
                    </div>
                  )}

                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                    <p className="text-white font-bold text-sm">{selectedSolicitud.nombre_prospecto}</p>
                    <p className="text-yellow-500 text-xs mt-0.5">Ingreso reportado: ${selectedSolicitud.ingreso_mensual}</p>
                    {selectedSolicitud.telefono && (
                      <p className="text-gray-400 text-xs mt-0.5"><i className="fa-solid fa-phone mr-1" />{selectedSolicitud.telefono}</p>
                    )}
                    {selectedSolicitud.ocupacion && (
                      <p className="text-gray-400 text-xs mt-0.5"><i className="fa-solid fa-briefcase mr-1" />{selectedSolicitud.ocupacion}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Formulario */}
              <div
                className={`w-full sm:w-1/2 flex flex-col min-h-0
                  ${mobileTab === 'configurar' ? 'flex-1' : 'hidden sm:flex'}`}
              >
                <div className="hidden sm:flex justify-between items-center px-4 pt-4 pb-2 shrink-0">
                  <h3 className="text-base font-bold text-white">Configurar Crédito</h3>
                  <button onClick={() => setSelectedSolicitud(null)} className="text-gray-500 hover:text-white text-2xl leading-none">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  <form id="formBandeja" onSubmit={handleAprobar} className="flex flex-col gap-4 py-4 sm:pt-1">

                    <div className="sm:hidden bg-gray-800/50 rounded-xl p-3">
                      <p className="text-white font-bold text-sm">{selectedSolicitud.nombre_prospecto}</p>
                      <p className="text-yellow-500 text-xs">Ingreso: ${selectedSolicitud.ingreso_mensual}</p>
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm font-medium">Monto Autorizado ($)</label>
                      <input
                        type="number"
                        className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none mt-1"
                        value={formData.monto}
                        onChange={e => setFormData({ ...formData, monto: Number(e.target.value) })}
                        required
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm font-medium">Esquema de Pago</label>
                      <select
                        className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none mt-1"
                        value={formData.semanas}
                        onChange={e => setFormData({ ...formData, semanas: Number(e.target.value) })}
                        required
                      >
                        <option value={28}>28 pagos diarios (~6 semanas)</option>
                        <option value={37}>37 pagos diarios (~8 semanas)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm font-medium">Tasa de Interés (%)</label>
                      <input
                        type="number" step="0.1" min="0" max="100"
                        className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none mt-1"
                        placeholder="ej: 2.5, 3, 5"
                        value={formData.tasa_interes}
                        onChange={e => setFormData({ ...formData, tasa_interes: Number(e.target.value) })}
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm font-medium">Asignar Cobrador de Ruta</label>
                      <select
                        className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none mt-1"
                        value={formData.cobrador_id}
                        onChange={e => setFormData({ ...formData, cobrador_id: e.target.value })}
                        required
                      >
                        <option value="" disabled>Selecciona un cobrador...</option>
                        {cobradores.map(cob => (
                          <option key={cob.id} value={cob.id}>{cob.nombre_completo}</option>
                        ))}
                      </select>
                    </div>

                    {formData.monto > 0 && formData.semanas > 0 && (
                      <InterestBreakdown
                        capital={formData.monto / formData.semanas}
                        interes={(formData.monto * (Number(formData.tasa_interes || 0) / 100)) / formData.semanas}
                        total={(formData.monto + formData.monto * (Number(formData.tasa_interes || 0) / 100)) / formData.semanas}
                        showTitle={true}
                      />
                    )}

                    <div className="hidden sm:flex gap-3 mt-2 pb-4">
                      <button
                        type="button"
                        onClick={() => handleRechazar(selectedSolicitud.id)}
                        className="w-1/3 py-3 border border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors font-bold"
                      >
                        Rechazar
                      </button>
                      <button
                        type="submit"
                        disabled={procesando}
                        className="w-2/3 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-900/40 transition-colors"
                      >
                        {procesando ? 'Generando...' : 'Aprobar y Generar Pagos'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Barra móvil */}
            <div
              className="sm:hidden shrink-0 flex gap-3 px-4 pt-3 bg-gray-950 border-t border-gray-800"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                onClick={() => handleRechazar(selectedSolicitud.id)}
                className="w-1/3 py-3 border border-gray-700 text-gray-400 active:bg-gray-800 rounded-xl font-bold transition-colors text-sm"
              >
                Rechazar
              </button>

              {mobileTab === 'expediente' ? (
                <button
                  type="button"
                  onClick={() => setMobileTab('configurar')}
                  className="w-2/3 bg-gray-700 active:bg-gray-600 text-white py-3 rounded-xl font-bold transition-colors text-sm flex items-center justify-center gap-2"
                >
                  Configurar <i className="fa-solid fa-arrow-right text-xs" />
                </button>
              ) : (
                <button
                  type="submit"
                  form="formBandeja"
                  disabled={procesando}
                  className="w-2/3 bg-red-600 active:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-900/40 transition-colors text-sm"
                >
                  {procesando ? 'Generando...' : '✓ Aprobar'}
                </button>
              )}
            </div>

          </div>
        </>
      )}

      {/* ── MODAL TRANSFERENCIAS ─────────────────────────────── */}
      {selectedTrans && (
        <>
          {/* Backdrop desktop */}
          <div
            className="hidden sm:block fixed inset-0 z-[109] bg-black/90 backdrop-blur-sm"
            onClick={() => { setSelectedTrans(null); setTransLightbox(false); }}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[110] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl sm:border sm:border-blue-900 sm:shadow-2xl bg-gray-950 flex flex-col overflow-hidden sm:max-h-[90vh]">

            {/* Header */}
            <div
              className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
              <button
                onClick={() => { setSelectedTrans(null); setTransLightbox(false); }}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-700 text-gray-400 active:bg-gray-800 transition-colors"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
              <div className="text-center">
                <p className="text-white font-bold text-sm">{selectedTrans.cliente_nombre}</p>
                <p className="text-blue-400 font-black text-base">${Number(selectedTrans.monto).toLocaleString('es-MX')}</p>
              </div>
              <button
                onClick={() => setTransLightbox(!transLightbox)}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-700 text-gray-400 active:bg-gray-800 transition-colors"
                title="Ampliar"
              >
                <i className="fa-solid fa-expand text-sm" />
              </button>
            </div>

            {/* Comprobante image */}
            <div className="flex-1 min-h-0 flex items-center justify-center bg-black p-2 overflow-hidden relative">
              {!transImgLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-blue-400 text-xs">Cargando imagen...</p>
                </div>
              )}
              <img
                key={selectedTrans.id}
                src={selectedTrans.comprobante_url}
                alt="Comprobante de transferencia"
                className="max-w-full max-h-full object-contain select-none transition-opacity duration-300"
                style={{ opacity: transImgLoaded ? 1 : 0 }}
                onLoad={() => setTransImgLoaded(true)}
                onError={() => setTransImgLoaded(true)}
              />
            </div>

            {/* Info strip */}
            <div className="shrink-0 px-4 py-2 border-t border-gray-800 bg-gray-900 space-y-1.5">
              {selectedTrans._mora > 0 && (
                <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-red-400 text-[10px] font-bold uppercase">Incluye mora</p>
                    <p className="text-red-300 text-[10px] font-bold">{selectedTrans._diasAtraso} día{selectedTrans._diasAtraso !== 1 ? 's' : ''} de atraso</p>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Cuota: <span className="text-white font-bold">${Math.round(selectedTrans._cuota).toLocaleString('es-MX')}</span></span>
                    <span className="text-red-400">Mora: <span className="font-bold">+${selectedTrans._mora.toLocaleString('es-MX')}</span></span>
                    <span className="text-white font-black">Total: ${Number(selectedTrans.monto).toLocaleString('es-MX')}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  {new Date(selectedTrans.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {selectedTrans.pago_diario_id ? (
                  <span className="text-blue-400 font-medium">Pago vinculado</span>
                ) : (
                  <span className="text-gray-600">Sin pago vinculado</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div
              className="shrink-0 flex gap-3 px-4 pt-3 bg-gray-950 border-t border-gray-800"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                onClick={handleRechazarTransferencia}
                disabled={procesandoTrans}
                className="w-1/3 py-3 border border-gray-700 text-gray-400 active:bg-gray-800 rounded-xl font-bold transition-colors text-sm disabled:opacity-40"
              >
                Rechazar
              </button>
              <button
                type="button"
                onClick={handleAprobarTransferencia}
                disabled={procesandoTrans}
                className="w-2/3 bg-emerald-600 active:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/40 transition-colors text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {procesandoTrans ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-circle-check" />
                    Aprobar Pago
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Lightbox con descarga */}
          {transLightbox && (
            <ImageLightbox
              src={selectedTrans.comprobante_url}
              alt={`Comprobante — ${selectedTrans.cliente_nombre}`}
              onClose={() => setTransLightbox(false)}
            />
          )}
        </>
      )}
    </main>
  );
}
