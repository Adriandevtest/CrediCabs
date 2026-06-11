'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ClientTable from '../components/ClientTable';
import ActionModal from '../components/ActionModal'; 
import { supabase } from '../lib/supabase';
import UserNav from '../components/UserNav';

export default function Home() {
  const [cobradores, setCobradores] = useState<any[]>([]);
  const [metricas, setMetricas] = useState({ capital: 0, clientes: 0, cobroHoy: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    verificarAccesoYDatos();
  }, []);

  const verificarAccesoYDatos = async () => {
    try {
      // 1. Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // 2. Verificar rol en profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (error || profile?.rol !== 'admin') {
        // Redirigir según el rol real si no es admin
        if (profile?.rol === 'cobrador') {
          router.push('/cobrador');
        } else if (profile?.rol === 'asesor') {
          router.push('/asesor');
        } else {
          router.push('/login');
        }
        return;
      }

      // 3. Si es admin, cargar datos
      cargarDatosDashboard();
      setLoading(false);
    } catch (error) {
      console.error("Error de acceso:", error);
      router.push('/login');
    }
  };

  const cargarDatosDashboard = async () => {
    try {
      const { data: cobradoresData } = await supabase
        .from('profiles')
        .select('id, nombre_completo')
        .eq('rol', 'cobrador');
      
      if (cobradoresData) setCobradores(cobradoresData);

      const { data: creditosData } = await supabase
        .from('creditos')
        .select('monto_total, monto_diario')
        .is('estado', null);
        
      if (creditosData) {
        const totalCapital = creditosData.reduce((suma, credito) => suma + Number(credito.monto_total), 0);
        const totalDiario = creditosData.reduce((suma, credito) => suma + Number(credito.monto_diario), 0);
        
        setMetricas({
          capital: totalCapital,
          clientes: creditosData.length,
          cobroHoy: Math.round(totalDiario)
        });
      }
    } catch (error) {
      console.error("Error cargando el dashboard:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Cargando acceso administrativo...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        <nav className="hidden md:flex justify-between items-center border-b border-gray-800 py-4 mb-8">
          <div className="flex gap-4">
            <Link href="/" className="px-5 py-2 border-b-2 border-red-600 text-white font-bold">Dashboard</Link>
            <Link href="/clientes" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Clientes</Link>
            <Link href="/equipo" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Equipo</Link>
            <Link href="/bandeja" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Bandeja</Link>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-black flex items-center gap-2 shadow-lg transition-all"
            >
              <span>+</span> NUEVO REGISTRO
            </button>
            <UserNav />
          </div>
        </nav>

        <header className="pt-6 pb-4 md:pt-0 md:border-b border-red-900 md:pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white">Credi <span className="text-red-600">Cab's</span></h1>
            <p className="text-gray-400 text-[10px] md:text-base tracking-widest uppercase">Admin Central</p>
          </div>
          <div className="md:hidden">
            <UserNav />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border-l-4 border-red-600 p-4 md:p-6 rounded-r-xl">
            <p className="text-gray-400 text-[10px] uppercase">Capital Colocado</p>
            <p className="text-2xl md:text-3xl font-bold text-white">${metricas.capital.toLocaleString('es-MX')}</p>
          </div>
          <div className="bg-gray-900 border-l-4 border-yellow-500 p-4 md:p-6 rounded-r-xl">
            <p className="text-gray-400 text-[10px] uppercase">Clientes Activos</p>
            <p className="text-2xl md:text-3xl font-bold text-white">{metricas.clientes}</p>
          </div>
          <div className="bg-gray-900 border-l-4 border-white p-4 md:p-6 rounded-r-xl">
            <p className="text-gray-400 text-[10px] uppercase">Cobro Hoy</p>
            <p className="text-2xl md:text-3xl font-bold text-yellow-500">${metricas.cobroHoy.toLocaleString('es-MX')}</p>
          </div>
        </div>

        <ClientTable />

        <ActionModal 
          isOpen={isModalOpen} 
          onClose={() => { setIsModalOpen(false); cargarDatosDashboard(); }} 
          cobradores={cobradores} 
        />
      </div>
    </main>
  );
}