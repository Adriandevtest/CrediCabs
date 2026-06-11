'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import TableWithDialog from '../../components/TableWithDialog';
import UserNav from '../../components/UserNav';
import RegisterClientForm from '../../components/RegisterClientForm';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '../../components/ui/dialog';

export default function ClientesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cobradores, setCobradores] = useState<any[]>([]);

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
    <main className="min-h-screen bg-[#030712] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Navegación */}
        <nav className="hidden md:flex justify-between items-center border-b border-gray-800 py-4 mb-8">
          <div className="flex gap-4">
            <Link href="/" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Dashboard</Link>
            <Link href="/clientes" className="px-5 py-2 border-b-2 border-red-600 text-white font-bold">Clientes</Link>
            <Link href="/equipo" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Equipo</Link>
            <Link href="/bandeja" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Bandeja</Link>
          </div>
          <div className="flex items-center gap-6">
            <UserNav />
          </div>
        </nav>

        {/* Header con Buscador integrado */}
        <header className="pt-6 pb-4 md:pt-0 md:border-b border-red-900 md:pb-6 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white">Directorio <span className="text-red-600">General</span></h1>
            <p className="text-gray-400 text-[10px] md:text-base tracking-widest uppercase">Clientes Activos</p>
          </div>

          {/* Buscador y Botón */}
          <div className="flex gap-4 w-full md:w-auto items-center">
            <div className="relative flex-1 md:flex-none md:w-72">
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

            {/* Botón Nuevo Cliente */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <button className="bg-red-600 hover:bg-red-700 text-white px-4 md:px-6 py-2 rounded-full font-black flex items-center gap-2 shadow-lg transition-all whitespace-nowrap">
                  <span>+</span> NUEVO
                </button>
              </DialogTrigger>
              <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-2xl outline-none">
                <DialogTitle className="sr-only">Nuevo Cliente</DialogTitle>
                <DialogDescription className="sr-only">Formulario para agregar un nuevo cliente y otorgar crédito.</DialogDescription>
                <RegisterClientForm
                  cobradores={cobradores}
                  onSuccess={() => { setIsModalOpen(false); window.location.reload(); }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="md:hidden">
            <UserNav />
          </div>
        </header>

        {/* Instancia de tu tabla pasando el buscador como prop */}
        <TableWithDialog searchQuery={searchQuery} />     

      </div>
    </main>
  );
}