'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import UserNav from '../../components/UserNav';

export default function CobradorPage() {
  const [ruta, setRuta] = useState<any[]>([]);
  const [completados, setCompletados] = useState<any[]>([]);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('nombre_completo')
        .eq('id', user.id)
        .single();

      if (perfil) {
        setNombreCobrador(perfil.nombre_completo.split(' ')[0]);
      }

      const { data, error } = await supabase
        .from('clientes')
        .select(`
          id,
          numero_cliente,
          profiles ( nombre_completo ),
          creditos ( id, monto_diario, estado, monto_total, interes_total, tasa_interes_porcentaje )
        `)
        .eq('cobrador_asignado_id', user.id)
        .order('numero_cliente', { ascending: true });

      if (error) throw error;

      const clientesActivos = data?.filter(c =>
        c.creditos && c.creditos.length > 0 &&
        (c.creditos[0].estado === 'activo' || !c.creditos[0].estado)
      ) || [];

      setRuta(clientesActivos);
    } catch (error) {
      console.error('Error al cargar la ruta:', error);
    } finally {
      setLoading(false);
    }
  };

  const registrarPago = async (clienteId: string, creditoId: string, monto: number) => {
    setProcesandoPago(clienteId);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const cliente = ruta.find(c => c.id === clienteId);
      if (cliente) setCompletados(prev => [...prev, cliente]);
      setRuta(prev => prev.filter(c => c.id !== clienteId));
    } catch (error) {
      alert('Error al registrar el pago.');
    } finally {
      setProcesandoPago(null);
    }
  };

  const totalDia = [...ruta, ...completados].reduce((acc, c) => acc + (c.creditos[0]?.monto_diario || 0), 0);
  const totalPendiente = ruta.reduce((acc, c) => acc + (c.creditos[0]?.monto_diario || 0), 0);
  const progreso = (ruta.length + completados.length) > 0
    ? Math.round((completados.length / (ruta.length + completados.length)) * 100)
    : 0;

  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <main className="min-h-screen pb-24 bg-gray-50">

      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 px-4 pt-4 pb-3">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-lg font-medium text-gray-900 leading-tight">
              Hola, <span className="text-red-600">{nombreCobrador || 'Cobrador'}</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{fechaHoy} · Ruta del día</p>
          </div>
          <UserNav />
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-red-600 rounded-full transition-all duration-500"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400">
            {completados.length} de {ruta.length + completados.length} cobros completados
          </span>
          <span className="text-xs text-red-600 font-medium">{progreso}%</span>
        </div>
      </header>

      <div className="px-4 pt-4 max-w-md mx-auto">

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Meta del día</p>
            <p className="text-xl font-medium text-red-600">
              ${Math.round(totalDia).toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">MXN total</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Por cobrar</p>
            <p className="text-xl font-medium text-gray-900">
              ${Math.round(totalPendiente).toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{ruta.length} visitas pendientes</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-3">
          Clientes pendientes
        </p>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando ruta...</div>
        ) : ruta.length === 0 && completados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-12 px-6">
            <p className="text-3xl mb-3">📭</p>
            <h3 className="text-gray-800 font-medium">Sin clientes asignados</h3>
            <p className="text-gray-400 text-sm mt-1">No tienes clientes en tu ruta hoy.</p>
          </div>
        ) : ruta.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-12 px-6">
            <p className="text-3xl mb-3">🎉</p>
            <h3 className="text-gray-800 font-medium">¡Ruta completada!</h3>
            <p className="text-gray-400 text-sm mt-1">
              Cobraste los {completados.length} clientes de hoy.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ruta.map((cliente) => {
              const credito = cliente.creditos[0];
              const isProcessing = procesandoPago === cliente.id;
              const atrasado = credito?.estado === 'atrasado';

              return (
                <div
                  key={cliente.id}
                  className={`bg-white rounded-2xl p-4 border ${atrasado ? 'border-red-200' : 'border-gray-100'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs text-gray-400 font-mono">
                        #{cliente.numero_cliente}
                      </span>
                      <h3 className="text-base font-medium text-gray-900 leading-tight mt-0.5">
                        {cliente.profiles?.nombre_completo}
                      </h3>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${atrasado ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {atrasado ? '⚠ Atrasado' : '✓ Activo'}
                      </span>
                      
 <a href="tel:1234567890" className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
  </svg>
</a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Cuota hoy</p>
                      <p className="text-xl font-medium text-red-600 mt-0.5">
                        ${Math.round(credito.monto_diario).toLocaleString('es-MX')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Deuda total</p>
                      <p className="text-base font-medium text-gray-700 mt-0.5">
                        ${Math.round(credito.monto_total).toLocaleString('es-MX')}
                      </p>
                    </div>
                  </div>

                  {credito.interes_total > 0 && (
                    <div className="rounded-xl p-3 mb-3 bg-amber-50 border border-amber-100">
                      <p className="text-xs text-amber-600 uppercase tracking-wider font-medium mb-2">
                        Desglose diario
                      </p>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Capital/día</span>
                        <span className="text-gray-700 font-medium">
                          ${(credito.monto_total / (credito.monto_total + credito.interes_total) * credito.monto_diario).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-amber-600">+ Interés/día</span>
                        <span className="text-amber-700 font-medium">
                          ${(credito.interes_total / (credito.monto_total + credito.interes_total) * credito.monto_diario).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => registrarPago(cliente.id, credito.id, credito.monto_diario)}
                    disabled={isProcessing}
                    className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-60 transition-colors text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <span className="animate-pulse">Procesando...</span>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Registrar pago
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