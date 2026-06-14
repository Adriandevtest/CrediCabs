'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import UserNav from '../../components/UserNav';
import { InterestBreakdown } from '../../components/InterestBreakdown';
import { LumaSpin } from '../../components/luma-spin';

export default function BandejaPage() {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [cobradores, setCobradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para la Modal de Aprobación
  const [selectedSolicitud, setSelectedSolicitud] = useState<any | null>(null);
  const [formData, setFormData] = useState({ monto: 5000, semanas: 28, tasa_interes: 0, cobrador_id: '' });
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 1. Traer solicitudes pendientes
      const { data: solData } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false });
      if (solData) setSolicitudes(solData);

      // 2. Traer cobradores para asignarlos si se aprueba
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

    // 1. NUEVA VALIDACIÓN: Revisar que se haya seleccionado un cobrador
    if (!formData.cobrador_id) {
      alert('⚠️ Por favor, selecciona un cobrador de la lista antes de aprobar.');
      return; // Detenemos el proceso aquí
    }

    setProcesando(true);

    try {
      if (!selectedSolicitud) return;

      // Usar API endpoint para crear cliente (mantiene sesión del admin)
      const tasaPorcentaje = parseFloat(formData.tasa_interes?.toString() || '0');
      const interesTotal = formData.monto * (tasaPorcentaje / 100);

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
          cobrador_asignado_id: formData.cobrador_id
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al crear cliente');
      }

      // Marcar solicitud como aprobada
      const { error: updateError } = await supabase
        .from('solicitudes')
        .update({ estado: 'aprobado' })
        .eq('id', selectedSolicitud.id);
      if (updateError) throw updateError;

      alert('¡Prospecto aprobado! Se ha convertido en cliente y su calendario de pagos está listo.');
      setSelectedSolicitud(null);
      cargarDatos(); // Recargar la lista
    } catch (error: any) {
      alert('Error al aprobar: ' + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async (id: string) => {
    if(!confirm('¿Estás seguro de rechazar esta solicitud?')) return;
    try {
      await supabase.from('solicitudes').update({ estado: 'rechazado' }).eq('id', id);
      cargarDatos();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 pb-20 md:p-8">
      {/* Header móvil sticky — fuera del contenedor con padding */}
      <header className="md:hidden sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-white leading-tight">Revisión de <span className="text-red-600">Prospectos</span></h1>
          <p className="text-gray-500 text-[9px] uppercase tracking-widest">Bandeja de Entrada</p>
        </div>
        <UserNav />
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-0">

        {/* Navegación — solo desktop */}
        <nav className="hidden md:flex justify-between items-center border-b border-gray-800 py-4 mb-8">
          <div className="flex gap-4">
            <Link href="/" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Dashboard</Link>
            <Link href="/clientes" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Clientes</Link>
            <Link href="/equipo" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Equipo</Link>
            <Link href="/bandeja" className="px-5 py-2 border-b-2 border-red-600 text-white font-bold">Bandeja</Link>
          </div>
          <div className="flex items-center gap-6">
            <UserNav />
          </div>
        </nav>

        {/* Header desktop */}
        <header className="hidden md:flex pt-0 pb-6 border-b border-red-900 justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-black text-white">Revisión de <span className="text-red-600">Prospectos</span></h1>
            <p className="text-gray-400 text-base tracking-widest uppercase">Bandeja de Entrada</p>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <LumaSpin />
          </div>
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
                  <p><i className="fa-solid fa-phone w-5 text-gray-500"></i> {sol.telefono}</p>
                  <p><i className="fa-solid fa-briefcase w-5 text-gray-500"></i> {sol.ocupacion}</p>
                  <p><i className="fa-solid fa-money-bill-wave w-5 text-green-500"></i> Ingreso: <span className="text-white font-bold">${sol.ingreso_mensual}</span></p>
                  <p className="text-xs mt-2 border-t border-gray-800 pt-2">{sol.direccion}</p>
                </div>

                <div className="flex gap-2 mt-auto">
                  <button onClick={() => setSelectedSolicitud(sol)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded font-bold transition-colors border border-gray-700">
                    Ver Expediente
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de Aprobación */}
        {selectedSolicitud && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="bg-gray-950 border border-red-900 w-full max-w-4xl rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">

              {/* Handle bar móvil */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-gray-700 rounded-full" />
              </div>

              <div className="flex flex-col md:flex-row flex-1 min-h-0">
              {/* Lado Izquierdo: Fotos y Datos */}
              <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-gray-800 bg-gray-900 overflow-y-auto md:max-h-[85vh]">
                <h2 className="text-lg font-bold text-white mb-3 border-l-4 border-yellow-500 pl-2">Expediente Digital</h2>

                {selectedSolicitud.ine_url && (
                  <div className="mb-3">
                    <p className="text-gray-400 text-[10px] uppercase mb-1 tracking-wide">Fotografía INE</p>
                    <a href={selectedSolicitud.ine_url} target="_blank" rel="noopener noreferrer"
                      className="block w-full bg-gray-800 rounded-xl overflow-hidden border border-gray-700 active:opacity-80">
                      <img src={selectedSolicitud.ine_url} alt="INE"
                        className="w-full max-h-52 object-contain" />
                    </a>
                    <p className="text-gray-600 text-[10px] mt-1 text-center">Toca para ver completo</p>
                  </div>
                )}

                {selectedSolicitud.comprobante_url && (
                  <div className="mb-3">
                    <p className="text-gray-400 text-[10px] uppercase mb-1 tracking-wide">Comprobante de Domicilio</p>
                    <a href={selectedSolicitud.comprobante_url} target="_blank" rel="noopener noreferrer"
                      className="block w-full bg-gray-800 rounded-xl overflow-hidden border border-gray-700 active:opacity-80">
                      <img src={selectedSolicitud.comprobante_url} alt="Comprobante"
                        className="w-full max-h-52 object-contain" />
                    </a>
                    <p className="text-gray-600 text-[10px] mt-1 text-center">Toca para ver completo</p>
                  </div>
                )}

                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <p className="text-white font-bold text-sm">{selectedSolicitud.nombre_prospecto}</p>
                  <p className="text-yellow-500 text-xs mt-0.5">Ingreso reportado: ${selectedSolicitud.ingreso_mensual}</p>
                </div>
              </div>

              {/* Lado Derecho: Formulario de Aprobación */}
              <div className="w-full md:w-1/2 p-4 flex flex-col overflow-y-auto md:max-h-[85vh]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-white">Configurar Crédito</h3>
                  <button onClick={() => setSelectedSolicitud(null)} className="text-gray-500 hover:text-white text-2xl leading-none">&times;</button>
                </div>

                <form onSubmit={handleAprobar} className="flex flex-col gap-4">
                  <div>
                    <label className="text-gray-400 text-sm font-medium">Monto Autorizado ($)</label>
                    <input type="number" className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none mt-1"
                      value={formData.monto} onChange={e => setFormData({...formData, monto: Number(e.target.value)})} required />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm font-medium">Esquema de Pago</label>
                    <select className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none mt-1"
                      value={formData.semanas} onChange={e => setFormData({...formData, semanas: Number(e.target.value)})} required>
                      <option value={28}>28 pagos diarios (~6 semanas)</option>
                      <option value={37}>37 pagos diarios (~8 semanas)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm font-medium">Tasa de Interés (%)</label>
                    <input type="number" step="0.1" min="0" max="100" className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none mt-1"
                      placeholder="ej: 2.5, 3, 5"
                      value={formData.tasa_interes} onChange={e => setFormData({...formData, tasa_interes: Number(e.target.value)})} />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm font-medium">Asignar Cobrador de Ruta</label>
                    <select className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none mt-1"
                      value={formData.cobrador_id} onChange={e => setFormData({...formData, cobrador_id: e.target.value})} required>
                      <option value="" disabled>Selecciona un cobrador...</option>
                      {cobradores.map(cob => (
                        <option key={cob.id} value={cob.id}>{cob.nombre_completo}</option>
                      ))}
                    </select>
                  </div>

                  {/* Vista Previa del Desglose */}
                  {formData.monto > 0 && formData.semanas > 0 && (
                    <div>
                      <InterestBreakdown
                        capital={formData.monto / formData.semanas}
                        interes={(formData.monto * (Number(formData.tasa_interes || 0) / 100)) / formData.semanas}
                        total={(formData.monto + (formData.monto * (Number(formData.tasa_interes || 0) / 100))) / formData.semanas}
                        showTitle={true}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => handleRechazar(selectedSolicitud.id)} className="w-1/3 py-3 border border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors font-bold">
                      Rechazar
                    </button>
                    <button type="submit" disabled={procesando} className="w-2/3 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-900/40 transition-colors">
                      {procesando ? 'Generando...' : 'Aprobar y Generar Pagos'}
                    </button>
                  </div>
                </form>
              </div>
              </div>{/* flex row */}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}