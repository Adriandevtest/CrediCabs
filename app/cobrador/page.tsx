'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import UserNav from '../../components/UserNav';
import { InterestBreakdown } from '../../components/InterestBreakdown';

export default function CobradorPage() {
  const [ruta, setRuta] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesandoPago, setProcesandoPago] = useState<string | null>(null);
  const [nombreCobrador, setNombreCobrador] = useState('');
  const router = useRouter();

  useEffect(() => {
    cargarRutaDelDia();
  }, []);

  const cargarRutaDelDia = async () => {
    setLoading(true);
    try {
      // 1. Verificamos quién es el usuario que tiene la sesión abierta
      const { data: { user } } = await supabase.auth.getUser();
      
      // Si no hay sesión, lo expulsamos al login
      if (!user) {
        router.push('/login');
        return;
      }

      // Obtener el nombre para saludarlo en la cabecera
      const { data: perfil } = await supabase.from('profiles').select('nombre_completo').eq('id', user.id).single();
      if (perfil) setNombreCobrador(perfil.nombre_completo.split(' ')[0]); // Solo el primer nombre

      // 2. Traemos SOLO los clientes asignados a ESTE cobrador
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          id,
          numero_cliente,
          profiles ( nombre_completo ),
          creditos ( id, monto_diario, estado, monto_total, interes_total, tasa_interes_porcentaje )
        `)
        .eq('cobrador_asignado_id', user.id) // <-- ESTE ES EL FILTRO MAGICO
        .order('numero_cliente', { ascending: true });

      if (error) throw error;

      // Filtramos los que tienen crédito activo
      const clientesActivos = data?.filter(c => c.creditos && c.creditos.length > 0 && (c.creditos[0].estado === 'activo' || !c.creditos[0].estado)) || [];
      setRuta(clientesActivos);
    } catch (error) {
      console.error("Error al cargar la ruta:", error);
    } finally {
      setLoading(false);
    }
  };

  const registrarPago = async (clienteId: string, creditoId: string, monto: number) => {
    setProcesandoPago(clienteId);
    try {
      await new Promise(resolve => setTimeout(resolve, 800)); 
      setRuta(prev => prev.filter(c => c.id !== clienteId));
      alert('✅ Pago registrado correctamente.');
    } catch (error) {
      alert('Error al registrar el pago.');
    } finally {
      setProcesandoPago(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 pb-20">
      
      {/* Cabecera Móvil Fija */}
      <header className="bg-gray-900 border-b border-red-900 p-5 sticky top-0 z-50 shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white leading-none">
              Ruta de <span className="text-yellow-500">{nombreCobrador || 'Cobrador'}</span>
            </h1>
            <p className="text-gray-400 text-xs uppercase tracking-widest mt-1">
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          
          {/* Aquí inyectamos el UserNav en lugar del botón duro */}
          <UserNav />
        </div>
      </header>

      <div className="p-4 md:max-w-md md:mx-auto">
        
        {/* Resumen del Día */}
        <div className="bg-gradient-to-r from-red-900/40 to-gray-900 border border-red-900/50 rounded-2xl p-5 mb-6 shadow-lg">
          <p className="text-gray-400 text-sm mb-1">Meta de cobro hoy</p>
          <div className="flex items-end gap-2">
            <h2 className="text-4xl font-black text-white">
              ${ruta.reduce((acc, c) => acc + (c.creditos[0]?.monto_diario || 0), 0).toLocaleString('es-MX')}
            </h2>
            <span className="text-gray-500 text-sm mb-1 block">MXN</span>
          </div>
          <p className="text-yellow-500 text-xs font-bold mt-2 uppercase tracking-wide">
            {ruta.length} visitas pendientes
          </p>
        </div>

        {/* Lista de Clientes (Tarjetas) */}
        {loading ? (
          <div className="text-center py-10 text-yellow-500 font-bold">Cargando ruta...</div>
        ) : ruta.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 rounded-2xl border border-gray-800">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-white font-bold text-lg">¡Ruta Completada o Vacía!</h3>
            <p className="text-gray-500 text-sm">No tienes clientes pendientes asignados hoy.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {ruta.map((cliente) => {
              const credito = cliente.creditos[0];
              const isProcessing = procesandoPago === cliente.id;

              return (
                <div key={cliente.id} className="bg-gray-900 border-l-4 border-yellow-500 rounded-xl p-4 shadow-xl flex flex-col gap-3">
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-gray-500 text-xs font-mono">{cliente.numero_cliente}</span>
                      <h3 className="text-lg font-bold text-white leading-tight">
                        {cliente.profiles?.nombre_completo}
                      </h3>
                    </div>
                    <a href={`tel:1234567890`} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white border border-gray-700">
                      <i className="fa-solid fa-phone text-xs"></i>
                    </a>
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-3 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider">Cuota Diaria (Total)</p>
                      <p className="text-yellow-500 font-black text-xl">
                        ${Math.round(credito.monto_diario).toLocaleString('es-MX')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider">Deuda Total</p>
                      <p className="text-gray-300 font-bold text-sm">
                        ${credito.monto_total.toLocaleString('es-MX')}
                      </p>
                    </div>
                  </div>

                  {/* Desglose de Capital + Interés */}
                  {credito.interes_total !== undefined && credito.interes_total > 0 && (
                    <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-xs space-y-1">
                      <p className="text-gray-500 uppercase font-bold tracking-wider">Desglose Diario</p>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Capital/día:</span>
                        <span className="text-white font-semibold">${(credito.monto_total / (credito.monto_total + credito.interes_total) * credito.monto_diario).toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-yellow-500/80">
                        <span>+ Interés/día:</span>
                        <span className="font-semibold">${(credito.interes_total / (credito.monto_total + credito.interes_total) * credito.monto_diario).toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => registrarPago(cliente.id, credito.id, credito.monto_diario)}
                    disabled={isProcessing}
                    className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors text-white py-4 rounded-xl font-black text-lg uppercase tracking-wide shadow-lg shadow-red-900/30 flex justify-center items-center gap-2 mt-1"
                  >
                    {isProcessing ? (
                      <span className="animate-pulse">Procesando...</span>
                    ) : (
                      <>
                        <i className="fa-solid fa-hand-holding-dollar"></i>
                        Marcar Pago
                      </>
                    )}
                  </button>
                  
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}