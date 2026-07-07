'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import UserNav from '../../components/UserNav';

// Componentes de Shadcn
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { AnimatedStaffForm } from '../../components/AnimatedStaffForm';
import { LumaSpin } from '../../components/luma-spin';
import AdminPinModal from '../../components/AdminPinModal';

const getIniciales = (nombre: string) => {
  if (!nombre) return '?';
  const p = nombre.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : p[0].substring(0, 2).toUpperCase();
};

export default function EquipoPage() {
  const [equipo, setEquipo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroRol, setFiltroRol] = useState<'todos' | 'cobrador' | 'supervisor'>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false); 

  // Estados para el Visor de Detalles y Seguridad
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [despidiendo, setDespidiendo] = useState(false);
  const [pinDespedirOpen, setPinDespedirOpen] = useState(false);
  const pendingDespedirRef = useRef<any>(null);
  const [clientesAsignados, setClientesAsignados] = useState<any[]>([]);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // ── Progreso del día ──
  const progresoSheetRef = useRef<HTMLDivElement>(null);
  const progresoY0 = useRef(0);
  const progresoSwipe = {
    onTouchStart: (e: React.TouchEvent) => {
      progresoY0.current = e.touches[0].clientY;
      if (progresoSheetRef.current) progresoSheetRef.current.style.transition = 'none';
    },
    onTouchMove: (e: React.TouchEvent) => {
      const d = e.touches[0].clientY - progresoY0.current;
      if (d > 0 && progresoSheetRef.current) progresoSheetRef.current.style.transform = `translateY(${d}px)`;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const d = e.changedTouches[0].clientY - progresoY0.current;
      if (!progresoSheetRef.current) return;
      progresoSheetRef.current.style.transition = 'transform 0.25s ease';
      if (d > 80) {
        progresoSheetRef.current.style.transform = 'translateY(110%)';
        setTimeout(() => setProgresoModal(null), 230);
      } else {
        progresoSheetRef.current.style.transform = 'translateY(0)';
      }
    },
  };

  const [progresoModal, setProgresoModal] = useState<{
    cobrador: any;
    loading: boolean;
    total: number;
    cobrados: number;
    clientes: { nombre: string; numero: string; cobrado: boolean; monto: number }[];
  } | null>(null);

  const fetchEquipo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('rol', ['supervisor', 'cobrador'])
        .order('nombre_completo', { ascending: true });

      if (error) throw error;
      if (data) setEquipo(data);
    } catch (error) {
      console.error("Error al cargar equipo:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDespedir = () => {
    if (!selectedMember) return;
    // Guardar referencia y cerrar el Dialog padre antes de abrir PIN modal.
    // El focus trap de Radix bloquea el teclado en móvil si el Dialog sigue abierto.
    pendingDespedirRef.current = selectedMember;
    setIsDetailsOpen(false);
    setPinDespedirOpen(true);
  };

  const confirmarDespedir = async () => {
    const member = pendingDespedirRef.current;
    if (!member) return;
    setDespidiendo(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      alert(`✅ ${member.nombre_completo} ha sido eliminado del equipo.`);
      pendingDespedirRef.current = null;
      setSelectedMember(null);
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
    setShowPasswordReset(false);
    setNewPassword('');

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

  const verProgreso = async (miembro: any) => {
    setProgresoModal({ cobrador: miembro, loading: true, total: 0, cobrados: 0, clientes: [] });
    const today = new Date().toLocaleDateString('en-CA');
    try {
      const { data } = await supabase
        .from('clientes')
        .select(`
          id, numero_cliente,
          profiles(nombre_completo),
          creditos(id, monto_diario, estado,
            pagos_diarios(id, pagado, fecha_esperada)
          )
        `)
        .eq('cobrador_asignado_id', miembro.id);

      const filas: { nombre: string; numero: string; cobrado: boolean; monto: number }[] = [];

      (data || []).forEach((cliente: any) => {
        const creditosActivos = (cliente.creditos || []).filter((c: any) => c.estado !== 'liquidado');
        creditosActivos.forEach((credito: any) => {
          const vencidos = (credito.pagos_diarios || []).filter(
            (p: any) => p.fecha_esperada <= today
          );
          if (vencidos.length === 0) return;
          const cobrado = vencidos.every((p: any) => p.pagado);
          filas.push({
            nombre: (cliente.profiles as any)?.nombre_completo || '—',
            numero: cliente.numero_cliente || '—',
            cobrado,
            monto: Math.round(credito.monto_diario || 0),
          });
        });
      });

      const cobrados = filas.filter(f => f.cobrado).length;
      // Ordenar: pendientes primero, luego cobrados
      filas.sort((a, b) => Number(a.cobrado) - Number(b.cobrado));

      setProgresoModal({
        cobrador: miembro,
        loading: false,
        total: filas.length,
        cobrados,
        clientes: filas,
      });
    } catch {
      setProgresoModal(null);
    }
  };

  useEffect(() => {
    fetchEquipo();
  }, []);

  const equipoFiltrado = equipo.filter((m) => filtroRol === 'todos' || m.rol === filtroRol);

  return (
    <main className="min-h-screen bg-gray-950 pb-20 md:p-8">
      {/* Header móvil sticky — fuera del contenedor con padding */}
      <header className="md:hidden sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-white leading-tight">Gestión de <span className="text-red-600">Personal</span></h1>
          <p className="text-gray-500 text-[9px] uppercase tracking-widest">Equipo en Campo</p>
        </div>
        <UserNav />
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-0">

        {/* Navegación Superior — solo desktop */}
        <nav className="hidden md:flex justify-between items-center border-b border-gray-800 py-4 mb-8">
          <div className="flex gap-4">
            <Link href="/" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Dashboard</Link>
            <Link href="/clientes" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Clientes</Link>
            <Link href="/equipo" className="px-5 py-2 border-b-2 border-red-600 text-white font-bold">Equipo</Link>
            <Link href="/bandeja" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Bandeja</Link>
            <Link href="/mapa" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Mapa</Link>
          </div>
          <div className="flex items-center gap-6">
            <UserNav />
          </div>
        </nav>

        {/* Header desktop */}
        <header className="hidden md:flex pt-0 pb-6 border-b border-red-900 justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-black text-white">Gestión de <span className="text-red-600">Personal</span></h1>
            <p className="text-gray-400 text-base tracking-widest uppercase">Equipo en Campo</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl text-center shadow-xl">
              <div className="w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border border-red-900/50">
                <i className="fa-solid fa-user-plus"></i>
              </div>
              <h3 className="text-white font-bold text-xl mb-2">Nuevo Integrante</h3>
              <p className="text-sm text-gray-400 mb-6">Añade cobradores o supervisores al sistema.</p>
              
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
            <div className="flex flex-col gap-4 mb-6 border-l-4 border-red-600 pl-3">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Plantilla Activa</h2>
                <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full font-bold">{equipoFiltrado.length}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFiltroRol('todos')}
                  className={`px-4 py-1.5 rounded-full text-xs font-black transition-colors ${filtroRol === 'todos' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroRol('cobrador')}
                  className={`px-4 py-1.5 rounded-full text-xs font-black transition-colors ${filtroRol === 'cobrador' ? 'bg-yellow-500 text-gray-950' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  Cobradores
                </button>
                <button
                  onClick={() => setFiltroRol('supervisor')}
                  className={`px-4 py-1.5 rounded-full text-xs font-black transition-colors ${filtroRol === 'supervisor' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  Supervisores
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <LumaSpin />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipoFiltrado.length === 0 ? (
                  <p className="text-gray-500 text-sm md:col-span-2 text-center py-8">Sin resultados para este filtro.</p>
                ) : equipoFiltrado.map((miembro) => (
                  <div key={miembro.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-yellow-500 transition-colors flex flex-col gap-3 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full overflow-hidden border-2 shrink-0 ${miembro.rol === 'supervisor' ? 'border-red-700' : 'border-yellow-700'}`}>
                        {(miembro.avatar_url || miembro.foto_url) ? (
                          <img
                            src={miembro.avatar_url || miembro.foto_url}
                            alt={miembro.nombre_completo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center text-sm font-black ${miembro.rol === 'supervisor' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                            {getIniciales(miembro.nombre_completo)}
                          </div>
                        )}
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
                    {miembro.rol === 'cobrador' && (
                      <button
                        onClick={() => verProgreso(miembro)}
                        className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-chart-simple text-[10px]" />
                        Ver progreso del día
                      </button>
                    )}
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
              {/* Avatar + nombre */}
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full overflow-hidden border-2 shrink-0 ${selectedMember.rol === 'supervisor' ? 'border-red-700' : 'border-yellow-700'}`}>
                  {(selectedMember.avatar_url || selectedMember.foto_url) ? (
                    <img
                      src={selectedMember.avatar_url || selectedMember.foto_url}
                      alt={selectedMember.nombre_completo}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-lg font-black ${selectedMember.rol === 'supervisor' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                      {getIniciales(selectedMember.nombre_completo)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-white font-bold text-base leading-tight">{selectedMember.nombre_completo}</p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${selectedMember.rol === 'supervisor' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                    {selectedMember.rol}
                  </span>
                </div>
              </div>

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

              {/* Restablecer Contraseña — colapsada por defecto */}
              <div className="bg-red-950/20 rounded-xl border border-red-900/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setShowPasswordReset(!showPasswordReset); setNewPassword(''); }}
                  className="w-full flex justify-between items-center px-4 py-3 text-left"
                >
                  <span className="text-red-500 font-bold text-sm">Restablecer Contraseña</span>
                  <i className={`fa-solid fa-chevron-${showPasswordReset ? 'up' : 'down'} text-red-700 text-xs`} />
                </button>

                {showPasswordReset && (
                  <div className="px-4 pb-4 flex flex-col gap-3">
                    <input
                      type="password"
                      placeholder="Nueva contraseña..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-gray-900 border border-red-900/50 rounded-lg p-3 text-sm w-full text-white focus:outline-none focus:border-red-500"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setResetting(true);
                        try {
                          const res = await fetch('/api/admin/reset-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: selectedMember.id, newPassword }),
                          });
                          if (!res.ok) throw new Error('Error al actualizar');
                          alert('✅ Contraseña actualizada correctamente.');
                          setNewPassword('');
                          setShowPasswordReset(false);
                          setIsDetailsOpen(false);
                        } catch (e: any) { alert(e.message); } finally { setResetting(false); }
                      }}
                      disabled={resetting || !newPassword}
                      className="w-full bg-red-600 py-3 rounded-lg text-xs font-bold uppercase hover:bg-red-700 disabled:opacity-50"
                    >
                      {resetting ? 'Actualizando...' : 'Confirmar Contraseña'}
                    </button>
                  </div>
                )}
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

      {/* ── MODAL PROGRESO DEL DÍA ── */}
      {progresoModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={() => setProgresoModal(null)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[51] md:inset-0 md:flex md:items-center md:justify-center"
            onClick={() => setProgresoModal(null)}
          >
            <div
              ref={progresoSheetRef}
              className="bg-gray-950 border border-gray-800 w-full md:max-w-sm rounded-t-3xl md:rounded-2xl flex flex-col"
              style={{ maxHeight: '85dvh' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle móvil — swipe para cerrar */}
              <div
                className="flex justify-center pt-3 pb-1 md:hidden shrink-0 touch-none select-none"
                {...progresoSwipe}
              >
                <div className="w-10 h-1 bg-gray-700 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-5 pt-3 pb-4 border-b border-gray-800 shrink-0">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest">Progreso del día</p>
                    <h3 className="text-white font-black text-base leading-tight">
                      {progresoModal.cobrador.nombre_completo}
                    </h3>
                  </div>
                  <button
                    onClick={() => setProgresoModal(null)}
                    className="text-gray-500 hover:text-white text-xl leading-none ml-3 shrink-0"
                  >
                    &times;
                  </button>
                </div>

                {progresoModal.loading ? (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-400 text-xs">Cargando...</span>
                  </div>
                ) : (
                  <>
                    {/* Contador */}
                    <div className="flex items-end gap-1.5 mt-3 mb-2">
                      <span className="text-3xl font-black text-yellow-400">{progresoModal.cobrados}</span>
                      <span className="text-gray-500 text-sm mb-1">de {progresoModal.total} clientes cobrados</span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progresoModal.total > 0 && progresoModal.cobrados === progresoModal.total
                            ? 'bg-emerald-500'
                            : 'bg-yellow-400'
                        }`}
                        style={{
                          width: progresoModal.total > 0
                            ? `${Math.round((progresoModal.cobrados / progresoModal.total) * 100)}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-600 text-[10px]">
                        {progresoModal.total - progresoModal.cobrados} pendientes
                      </span>
                      <span className={`text-[10px] font-bold ${
                        progresoModal.total > 0 && progresoModal.cobrados === progresoModal.total
                          ? 'text-emerald-400'
                          : 'text-yellow-400'
                      }`}>
                        {progresoModal.total > 0
                          ? `${Math.round((progresoModal.cobrados / progresoModal.total) * 100)}%`
                          : '—'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Lista de clientes */}
              {!progresoModal.loading && (
                <div className="overflow-y-auto flex-1 min-h-0 divide-y divide-gray-800/60">
                  {progresoModal.clientes.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-8">Sin clientes en ruta hoy</p>
                  ) : (
                    progresoModal.clientes.map((c, i) => (
                      <div key={i} className={`flex items-center gap-3 px-5 py-3 ${c.cobrado ? 'bg-emerald-950/20' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          c.cobrado
                            ? 'bg-emerald-500'
                            : 'bg-gray-800 border border-gray-700'
                        }`}>
                          {c.cobrado
                            ? <i className="fa-solid fa-check text-white text-[10px]" />
                            : <i className="fa-solid fa-clock text-gray-500 text-[10px]" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${c.cobrado ? 'text-emerald-300' : 'text-white'}`}>
                            {c.nombre}
                          </p>
                          <p className="text-gray-500 text-[10px]">#{c.numero}</p>
                        </div>
                        <p className={`text-sm font-bold shrink-0 ${c.cobrado ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {c.cobrado ? '+' : ''}${c.monto.toLocaleString('es-MX')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <AdminPinModal
        open={pinDespedirOpen}
        titulo="Despedir Personal"
        descripcion={`¿Seguro que deseas eliminar a ${selectedMember?.nombre_completo} del equipo? Esta acción no se puede deshacer.`}
        onConfirm={() => { setPinDespedirOpen(false); confirmarDespedir(); }}
        onCancel={() => setPinDespedirOpen(false)}
      />
    </main>
  );
}