'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import UserNav from '../../components/UserNav';
import { InterestBreakdown } from '../../components/InterestBreakdown';
import { LumaSpin } from '../../components/luma-spin';
import { ImageLightbox } from '../../components/ImageLightbox';

export default function BandejaPage() {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [cobradores, setCobradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSolicitud, setSelectedSolicitud] = useState<any | null>(null);
  const [formData, setFormData] = useState({ monto: 5000, semanas: 28, tasa_interes: 0, cobrador_id: '' });
  const [procesando, setProcesando] = useState(false);
  const [mobileTab, setMobileTab] = useState<'expediente' | 'configurar'>('expediente');
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => { cargarDatos(); }, []);

  // Reset tab when a new solicitud is selected
  useEffect(() => {
    if (selectedSolicitud) setMobileTab('expediente');
  }, [selectedSolicitud?.id]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const { data: solData } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false });
      if (solData) setSolicitudes(solData);

      const { data: cobData } = await supabase
        .from('profiles')
        .select('id, nombre_completo')
        .eq('rol', 'cobrador');
      if (cobData) setCobradores(cobData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
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
      setSelectedSolicitud(null);
      cargarDatos();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 pb-20 md:p-8">
      {/* Header móvil sticky */}
      <header className="md:hidden sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-white leading-tight">Revisión de <span className="text-red-600">Prospectos</span></h1>
          <p className="text-gray-500 text-[9px] uppercase tracking-widest">Bandeja de Entrada</p>
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
        <header className="hidden md:flex pt-0 pb-6 border-b border-red-900 justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-black text-white">Revisión de <span className="text-red-600">Prospectos</span></h1>
            <p className="text-gray-400 text-base tracking-widest uppercase">Bandeja de Entrada</p>
          </div>
        </header>

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
                    setFormData({ monto: 5000, semanas: 28, tasa_interes: 0, cobrador_id: '' });
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded font-bold transition-colors border border-gray-700"
                >
                  Ver Expediente
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL ─────────────────────────────────────────────── */}
      {selectedSolicitud && (
        <>
          {/* Lightbox para fotos */}
          {lightbox && (
            <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
          )}

          {/* Backdrop desktop */}
          <div
            className="hidden sm:block fixed inset-0 z-[109] bg-black/90 backdrop-blur-sm"
            onClick={() => setSelectedSolicitud(null)}
          />

          {/* Modal container — full screen en móvil, centered card en desktop */}
          <div className="fixed inset-0 z-[110] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-4xl sm:rounded-2xl sm:border sm:border-red-900 sm:shadow-2xl bg-gray-950 flex flex-col overflow-hidden sm:max-h-[90vh]">

            {/* ── HEADER MÓVIL con tabs ── */}
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

                {/* Tabs */}
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

            {/* ── HANDLE DESKTOP ── */}
            <div className="hidden sm:flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>

            {/* ── CONTENIDO PRINCIPAL ── */}
            <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">

              {/* IZQUIERDA: Expediente (fotos) */}
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

              {/* DERECHA: Formulario */}
              <div
                className={`w-full sm:w-1/2 flex flex-col min-h-0
                  ${mobileTab === 'configurar' ? 'flex-1' : 'hidden sm:flex'}`}
              >
                {/* Header desktop del formulario */}
                <div className="hidden sm:flex justify-between items-center px-4 pt-4 pb-2 shrink-0">
                  <h3 className="text-base font-bold text-white">Configurar Crédito</h3>
                  <button onClick={() => setSelectedSolicitud(null)} className="text-gray-500 hover:text-white text-2xl leading-none">&times;</button>
                </div>

                {/* Formulario scrollable */}
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  <form id="formBandeja" onSubmit={handleAprobar} className="flex flex-col gap-4 py-4 sm:pt-1">

                    {/* Mini info del prospecto en móvil */}
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

                    {/* Botones dentro del form — solo desktop */}
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

            {/* ── BARRA DE BOTONES MÓVIL — siempre visible en móvil ── */}
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
    </main>
  );
}
