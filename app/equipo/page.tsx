'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import UserNav from '../../components/UserNav';

// Componentes de Shadcn
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { AnimatedStaffForm } from '../../components/AnimatedStaffForm';

export default function EquipoPage() {
  const [equipo, setEquipo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false); 

  // Estados para el Visor de Detalles y Seguridad
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [despidiendo, setDespidiendo] = useState(false);
  const [clientesAsignados, setClientesAsignados] = useState<any[]>([]);

  const fetchEquipo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('rol', ['asesor', 'cobrador'])
        .order('nombre_completo', { ascending: true });

      if (error) throw error;
      if (data) setEquipo(data);
    } catch (error) {
      console.error("Error al cargar equipo:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDespedir = async () => {
    if (!selectedMember) return;
    if (!confirm(`⚠️ ¿Estás seguro de que deseas despedir a ${selectedMember.nombre_completo}? Esta acción no se puede deshacer.`)) return;

    setDespidiendo(true);
    try {
      // Eliminar del perfil
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedMember.id);

      if (error) throw error;

      alert(`✅ ${selectedMember.nombre_completo} ha sido eliminado del equipo.`);
      setSelectedMember(null);
      setIsDetailsOpen(false);
      fetchEquipo(); // Recargar lista
    } catch (error: any) {
      alert('❌ Error al despedir: ' + error.message);
    } finally {
      setDespidiendo(false);
    }
  };

  const abrirDetalles = async (miembro: any) => {
    setSelectedMember(miembro);
    setIsDetailsOpen(true);

    // Si es cobrador, traer sus clientes
    if (miembro.rol === 'cobrador') {
      try {
        const { data } = await supabase
          .from('clientes')
          .select('id, numero_cliente, profiles(nombre_completo), creditos(monto_total, monto_diario)')
          .eq('cobrador_asignado_id', miembro.id);

        if (data) setClientesAsignados(data);
      } catch (error) {
        console.error('Error cargando clientes:', error);
      }
    } else {
      setClientesAsignados([]);
    }
  };

  useEffect(() => {
    fetchEquipo();
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Navegación Superior */}
        <nav className="hidden md:flex justify-between items-center border-b border-gray-800 py-4 mb-8">
          <div className="flex gap-4">
            <Link href="/" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Dashboard</Link>
            <Link href="/clientes" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Clientes</Link>
            <Link href="/equipo" className="px-5 py-2 border-b-2 border-red-600 text-white font-bold">Equipo</Link>
            <Link href="/bandeja" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Bandeja</Link>
          </div>
          <div className="flex items-center gap-6">
            <UserNav />
          </div>
        </nav>

        <header className="pt-6 pb-4 md:pt-0 md:border-b border-red-900 md:pb-6 flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white">Gestión de <span className="text-red-600">Personal</span></h1>
            <p className="text-gray-400 text-[10px] md:text-base tracking-widest uppercase">Equipo en Campo</p>
          </div>
          <div className="md:hidden">
            <UserNav />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl text-center shadow-xl">
              <div className="w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border border-red-900/50">
                <i className="fa-solid fa-user-plus"></i>
              </div>
              <h3 className="text-white font-bold text-xl mb-2">Nuevo Integrante</h3>
              <p className="text-sm text-gray-400 mb-6">Añade cobradores o asesores al sistema.</p>
              
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <button className="w-full bg-red-600 hover:bg-red-700 transition-all text-white font-black py-4 rounded-xl shadow-lg shadow-red-900/40 uppercase">
                    Registrar Personal
                  </button>
                </DialogTrigger>
                <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-2xl outline-none">
                  <DialogTitle className="sr-only">Alta de Personal</DialogTitle>
                  <DialogDescription className="sr-only">Formulario de registro de empleados.</DialogDescription>
                  <AnimatedStaffForm 
                    onSuccess={() => { fetchEquipo(); setIsModalOpen(false); }} 
                    onCancel={() => setIsModalOpen(false)} 
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6 border-l-4 border-red-600 pl-3">
              <h2 className="text-2xl font-bold text-white">Plantilla Activa</h2>
              <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full font-bold">{equipo.length}</span>
            </div>

            {loading ? <div className="text-yellow-500 font-bold p-8 text-center">Cargando...</div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipo.map((miembro) => (
                  <div key={miembro.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-yellow-500 transition-colors flex flex-col gap-3 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${miembro.rol === 'asesor' ? 'border-red-900 text-red-500' : 'border-yellow-700 text-yellow-500'}`}>
                        <i className={`fa-solid ${miembro.rol === 'asesor' ? 'fa-briefcase' : 'fa-motorcycle'}`}></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{miembro.nombre_completo}</h3>
                        <p className="text-xs uppercase font-bold text-gray-400">{miembro.rol}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => abrirDetalles(miembro)}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                      Ver Datos y Accesos
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE DETALLES Y SEGURIDAD */}
   {/* MODAL DE DETALLES Y SEGURIDAD */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-sm rounded-2xl p-6">
          <DialogTitle className="text-xl font-bold border-b border-gray-800 pb-4">Perfil del Personal</DialogTitle>
          <DialogDescription className="sr-only">Panel administrativo para gestión de accesos.</DialogDescription>
          
          {selectedMember && (
            <div className="space-y-4">
              {/* Sección de datos visibles */}
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 text-sm space-y-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Nombre</p>
                  <p className="text-white font-bold">{selectedMember.nombre_completo}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Correo</p>
                    <p className="text-white text-xs truncate">{selectedMember.email || 'Sin correo'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Teléfono</p>
                    <p className="text-white text-xs">{selectedMember.telefono || 'Sin número'}</p>
                  </div>
                </div>
              </div>

              {/* Restablecer Contraseña */}
              <div className="bg-red-950/20 p-4 rounded-xl border border-red-900/30">
                <h4 className="text-red-500 font-bold text-sm mb-3">Restablecer Contraseña</h4>
                <input 
                  type="text" 
                  placeholder="Nueva contraseña..." 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-gray-900 border border-red-900/50 rounded-lg p-3 text-sm w-full mb-3 text-white"
                />
                <button 
                  onClick={async () => {
                    setResetting(true);
                    try {
                      const res = await fetch('/api/admin/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: selectedMember.id, newPassword })
                      });
                      if (!res.ok) throw new Error('Error al actualizar');
                      alert('✅ Contraseña actualizada correctamente.');
                      setNewPassword('');
                      setIsDetailsOpen(false);
                    } catch (e: any) { alert(e.message); } finally { setResetting(false); }
                  }}
                  disabled={resetting || !newPassword}
                  className="w-full bg-red-600 py-3 rounded-lg text-xs font-bold uppercase hover:bg-red-700 disabled:opacity-50"
                >
                  {resetting ? 'Actualizando...' : 'Confirmar Nueva Contraseña'}
                </button>
              </div>

              {/* Clientes Asignados (solo para cobradores) */}
              {selectedMember.rol === 'cobrador' && (
                <div className="bg-blue-950/20 p-4 rounded-xl border border-blue-900/50">
                  <h4 className="text-blue-400 font-bold text-sm mb-3">👥 Clientes Asignados</h4>
                  {clientesAsignados.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {clientesAsignados.map((cliente) => (
                        <div key={cliente.id} className="bg-gray-900 p-3 rounded-lg border border-gray-800">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <p className="text-white font-bold text-sm">{cliente.profiles?.nombre_completo}</p>
                              <p className="text-gray-400 text-xs">{cliente.numero_cliente}</p>
                            </div>
                            {cliente.creditos && cliente.creditos.length > 0 && (
                              <div className="text-right">
                                <p className="text-yellow-500 font-bold text-sm">${cliente.creditos[0].monto_total.toLocaleString('es-MX')}</p>
                                <p className="text-gray-400 text-xs">Crédito activo</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs">Sin clientes asignados</p>
                  )}
                </div>
              )}

              {/* Sección de Despido */}
              <div className="bg-red-950/40 p-4 rounded-xl border border-red-900/50">
                <button
                  onClick={handleDespedir}
                  disabled={despidiendo}
                  className="w-full bg-red-700 hover:bg-red-800 py-3 rounded-lg text-xs font-bold uppercase transition-colors disabled:opacity-50"
                >
                  {despidiendo ? 'Eliminando...' : '🗑️ Despedir del Equipo'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}