'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import TableWithDialog from '../../components/TableWithDialog';
import UserNav from '../../components/UserNav';
import RegisterClientForm from '../../components/RegisterClientForm';
import ClientesEnMora from '../../components/ClientesEnMora';
import CreditosActivos from '../../components/CreditosActivos';
import { Input } from '../../components/ui/input';

type Vista = 'todos' | 'mora' | 'creditos';

export default function ClientesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cobradores, setCobradores] = useState<any[]>([]);
  const [vista, setVista] = useState<Vista>('todos');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    cargarCobradores();
  }, []);

  const cargarCobradores = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, nombre_completo')
        .eq('rol', 'cobrador');
      if (data) setCobradores(data);
    } catch (error) {
      console.error("Error al cargar cobradores:", error);
    }
  };

  return (
    <main className="min-h-screen bg-[#030712] pb-20 md:p-8">
      {/* Header móvil sticky — fuera del contenedor con padding */}
      <header className="md:hidden sticky top-0 z-40 bg-[#030712]/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-white leading-tight">Directorio <span className="text-red-600">General</span></h1>
          <p className="text-gray-500 text-[9px] uppercase tracking-widest">Clientes Activos</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsModalOpen(true)} className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">+ Nuevo</button>
          <UserNav />
        </div>
      </header>

      {/* Tab switcher móvil */}
      <div className="md:hidden flex gap-2 px-4 pt-3 pb-1">
        <button
          onClick={() => setVista('todos')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-colors ${vista === 'todos' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setVista('creditos')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 ${vista === 'creditos' ? 'bg-yellow-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}
        >
          <i className="fa-solid fa-coins text-[10px]" />
          Cartera
        </button>
        <button
          onClick={() => setVista('mora')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 ${vista === 'mora' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          <i className="fa-solid fa-triangle-exclamation text-[10px]" />
          Mora
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-0">

        {/* Navegación — solo desktop */}
        <nav className="hidden md:flex justify-between items-center border-b border-gray-800 py-4 mb-8">
          <div className="flex gap-4">
            <Link href="/" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Dashboard</Link>
            <Link href="/clientes" className="px-5 py-2 border-b-2 border-red-600 text-white font-bold">Clientes</Link>
            <Link href="/equipo" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Equipo</Link>
            <Link href="/bandeja" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Bandeja</Link>
            <Link href="/mapa" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Mapa</Link>
          </div>
          <div className="flex items-center gap-6">
            <UserNav />
          </div>
        </nav>

        {/* Header desktop + Dialog (Dialog se renderiza en portal, funciona también desde móvil) */}
        <header className="hidden md:flex pt-0 pb-6 border-b border-red-900 justify-between items-start md:items-center mb-8 gap-4 flex-col md:flex-row">
          <div>
            <h1 className="text-4xl font-black text-white">Directorio <span className="text-red-600">General</span></h1>
            <p className="text-gray-400 text-base tracking-widest uppercase">Clientes Activos</p>
            {/* Tab switcher desktop */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setVista('todos')}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition-colors ${vista === 'todos' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                Todos los clientes
              </button>
              <button
                onClick={() => setVista('creditos')}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition-colors flex items-center gap-1.5 ${vista === 'creditos' ? 'bg-yellow-500 text-gray-950' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                <i className="fa-solid fa-coins text-[10px]" />
                Cartera activa
              </button>
              <button
                onClick={() => setVista('mora')}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition-colors flex items-center gap-1.5 ${vista === 'mora' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                <i className="fa-solid fa-triangle-exclamation text-[10px]" />
                Clientes en mora
              </button>
            </div>
          </div>

          <div className="flex gap-4 w-full md:w-auto items-center">
            <div className="relative md:w-72">
              <svg
                className="absolute left-3 top-3 h-4 w-4 text-gray-500"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                placeholder="Buscar cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 rounded-full"
              />
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-black flex items-center gap-2 shadow-lg transition-all whitespace-nowrap"
            >
              <span>+</span> NUEVO
            </button>

            {isModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm">
                <div
                  className="bg-gray-950 border border-red-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
                  style={{ maxHeight: '90dvh' }}
                >
                  <div className="shrink-0 p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest">Alta de Cliente</h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                  </div>
                  <div className="overflow-y-auto flex-1 min-h-0">
                    <RegisterClientForm
                      cobradores={cobradores}
                      onSuccess={() => { setIsModalOpen(false); setRefreshKey(k => k + 1); }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Barra de búsqueda móvil */}
        <div className="md:hidden px-1 pt-3 pb-2">
          <div className="relative">
            <svg
              className="absolute left-3 top-3 h-4 w-4 text-gray-500"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 rounded-full"
            />
          </div>
        </div>

        {/* Contenido según tab */}
        {vista === 'todos'    && <TableWithDialog key={refreshKey} searchQuery={searchQuery} />}
        {vista === 'creditos' && <CreditosActivos searchQuery={searchQuery} />}
        {vista === 'mora'     && <ClientesEnMora searchQuery={searchQuery} />}

      </div>
    </main>
  );
}