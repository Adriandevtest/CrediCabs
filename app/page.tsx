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
  const [metricas, setMetricas] = useState({
    capital: 0,
    clientes: 0,
    cobroHoy: 0,
    interesProyectado: 0,
    roiPorcentaje: 0,
  });
  const [corteCaja, setCorteCaja] = useState<any[]>([]);
  const [totalCobradoHoy, setTotalCobradoHoy] = useState(0);
  const [metaHoy, setMetaHoy] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const hoy = new Date();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const fechaHoyLabel = hoy.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    verificarAccesoYDatos();

    const channel = supabase
      .channel('admin-dashboard-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagos_diarios' }, () => {
        cargarDatosDashboard();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creditos' }, () => {
        cargarDatosDashboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const verificarAccesoYDatos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (error || profile?.rol !== 'admin') {
        if (profile?.rol === 'cobrador') router.push('/cobrador');
        else if (profile?.rol === 'asesor') router.push('/asesor');
        else router.push('/login');
        return;
      }

      await cargarDatosDashboard();
      setLoading(false);
    } catch (error) {
      console.error('Error de acceso:', error);
      router.push('/login');
    }
  };

  const cargarDatosDashboard = async () => {
    try {
      // 1. Cobradores
      const { data: cobradoresData } = await supabase
        .from('profiles')
        .select('id, nombre_completo')
        .eq('rol', 'cobrador');
      if (cobradoresData) setCobradores(cobradoresData);

      // 2. Créditos activos → Capital, Clientes, ROI
      const { data: creditosData } = await supabase
        .from('creditos')
        .select('monto_total, monto_diario, interes_total, semanas_autorizadas')
        .or('estado.eq.activo,estado.is.null,estado.eq.atrasado');

      if (creditosData) {
        const totalCapital = creditosData.reduce((s, c) => s + Number(c.monto_total || 0), 0);
        const totalInteres = creditosData.reduce((s, c) => s + Number(c.interes_total || 0), 0);
        const roiPct = totalCapital > 0 ? (totalInteres / totalCapital) * 100 : 0;

        // Meta del día: créditos con pago esperado hoy
        const { data: pagosEsperadosHoy } = await supabase
          .from('pagos_diarios')
          .select('creditos(monto_diario)')
          .eq('fecha_esperada', fechaHoy);

        const meta = (pagosEsperadosHoy || []).reduce(
          (s: number, p: any) => s + Number(p.creditos?.monto_diario || 0), 0
        );
        setMetaHoy(Math.round(meta));

        setMetricas({
          capital: totalCapital,
          clientes: creditosData.length,
          cobroHoy: Math.round(meta),
          interesProyectado: totalInteres,
          roiPorcentaje: roiPct,
        });
      }

      // 3. Corte de caja: todos los pagos marcados como pagados con fecha_esperada = hoy
      const { data: pagadosHoy } = await supabase
        .from('pagos_diarios')
        .select(`
          id, numero_dia,
          creditos (
            monto_diario, semanas_autorizadas,
            clientes (
              numero_cliente,
              profiles ( nombre_completo )
            )
          )
        `)
        .eq('pagado', true)
        .eq('fecha_esperada', fechaHoy)
        .order('numero_dia', { ascending: true });

      if (pagadosHoy) {
        setCorteCaja(pagadosHoy);
        const totalHoy = pagadosHoy.reduce(
          (s: number, p: any) => s + Number(p.creditos?.monto_diario || 0), 0
        );
        setTotalCobradoHoy(Math.round(totalHoy));
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Cargando acceso administrativo...
      </div>
    );
  }

  const porcentajeMeta = metaHoy > 0 ? Math.min(100, Math.round((totalCobradoHoy / metaHoy) * 100)) : 0;

  return (
    <main className="min-h-screen bg-gray-950 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* Nav escritorio */}
        <nav className="hidden md:flex justify-between items-center border-b border-gray-800 py-4 mb-8">
          <div className="flex gap-4">
            <Link href="/" className="px-5 py-2 border-b-2 border-red-600 text-white font-bold">Dashboard</Link>
            <Link href="/clientes" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Clientes</Link>
            <Link href="/equipo" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Equipo</Link>
            <Link href="/bandeja" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Bandeja</Link>
            <Link href="/mapa" className="px-5 py-2 text-gray-400 hover:text-yellow-500 transition-colors font-medium">Mapa</Link>
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

        {/* Header */}
        <header className="pt-6 pb-4 md:pt-0 md:border-b border-red-900 md:pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white">Credi <span className="text-red-600">Cab's</span></h1>
            <p className="text-gray-400 text-[10px] md:text-base tracking-widest uppercase">Admin Central</p>
          </div>
          <div className="md:hidden"><UserNav /></div>
        </header>

        {/* Métricas principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 mt-6">
          <div className="bg-gray-900 border-l-4 border-red-600 p-4 md:p-6 rounded-r-xl">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">Capital Colocado</p>
            <p className="text-xl md:text-3xl font-bold text-white mt-1">${metricas.capital.toLocaleString('es-MX')}</p>
          </div>
          <div className="bg-gray-900 border-l-4 border-yellow-500 p-4 md:p-6 rounded-r-xl">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">Clientes Activos</p>
            <p className="text-xl md:text-3xl font-bold text-white mt-1">{metricas.clientes}</p>
          </div>
          <div className="bg-gray-900 border-l-4 border-white p-4 md:p-6 rounded-r-xl">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">Meta de Hoy</p>
            <p className="text-xl md:text-3xl font-bold text-yellow-500 mt-1">${metricas.cobroHoy.toLocaleString('es-MX')}</p>
          </div>
          <div className="bg-gray-900 border-l-4 border-emerald-500 p-4 md:p-6 rounded-r-xl">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">Retorno de Inversión</p>
            <p className="text-xl md:text-3xl font-bold text-emerald-400 mt-1">
              {metricas.roiPorcentaje.toFixed(1)}%
            </p>
            <p className="text-gray-500 text-[10px] mt-1">
              +${metricas.interesProyectado.toLocaleString('es-MX', { maximumFractionDigits: 0 })} interés
            </p>
          </div>
        </div>

        {/* Corte de Caja */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-8">
          {/* Header corte */}
          <div className="px-4 md:px-6 py-4 border-b border-gray-800 bg-gray-950 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-lg">Corte de Caja</h2>
                <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full capitalize">{fechaHoyLabel}</span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">Pagos registrados hoy en todas las rutas</p>
            </div>
            {/* Progreso del día */}
            <div className="flex flex-col gap-1 md:min-w-[200px]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">
                  <span className="text-emerald-400 font-bold">${totalCobradoHoy.toLocaleString('es-MX')}</span>
                  {' / '}${metaHoy.toLocaleString('es-MX')}
                </span>
                <span className="text-emerald-400 font-bold">{porcentajeMeta}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${porcentajeMeta}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500">{corteCaja.length} pagos cobrados de {/* calcular pendientes */} meta diaria</p>
            </div>
          </div>

          {corteCaja.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-2xl mb-2">🕐</p>
              <p className="text-gray-500 text-sm">Aún no hay cobros registrados hoy</p>
            </div>
          ) : (
            <>
              {/* Tabla escritorio */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                      <th className="px-6 py-3 font-medium">Cliente</th>
                      <th className="px-6 py-3 font-medium">No. Cliente</th>
                      <th className="px-6 py-3 font-medium text-center">Pago</th>
                      <th className="px-6 py-3 font-medium text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {corteCaja.map((pago, i) => {
                      const cliente = pago.creditos?.clientes;
                      const monto = pago.creditos?.monto_diario || 0;
                      const total = pago.creditos?.semanas_autorizadas || 0;
                      return (
                        <tr key={pago.id} className={`hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-800/20'}`}>
                          <td className="px-6 py-3 text-white font-medium">
                            {cliente?.profiles?.nombre_completo || '—'}
                          </td>
                          <td className="px-6 py-3 text-yellow-500 font-mono text-xs">
                            {cliente?.numero_cliente || '—'}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className="text-[11px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                              {pago.numero_dia} / {total}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-emerald-400 font-bold">
                            +${Math.round(monto).toLocaleString('es-MX')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-700 bg-gray-950">
                      <td colSpan={3} className="px-6 py-3 text-gray-400 text-sm font-medium">
                        Total cobrado hoy ({corteCaja.length} pagos)
                      </td>
                      <td className="px-6 py-3 text-right text-emerald-400 font-black text-lg">
                        ${totalCobradoHoy.toLocaleString('es-MX')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Lista móvil */}
              <div className="md:hidden divide-y divide-gray-800/60">
                {corteCaja.map((pago) => {
                  const cliente = pago.creditos?.clientes;
                  const monto = pago.creditos?.monto_diario || 0;
                  const total = pago.creditos?.semanas_autorizadas || 0;
                  return (
                    <div key={pago.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {cliente?.profiles?.nombre_completo || '—'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-yellow-500 font-mono text-[10px]">{cliente?.numero_cliente}</span>
                          <span className="text-gray-500 text-[10px]">Pago {pago.numero_dia}/{total}</span>
                        </div>
                      </div>
                      <p className="text-emerald-400 font-bold text-sm shrink-0">
                        +${Math.round(monto).toLocaleString('es-MX')}
                      </p>
                    </div>
                  );
                })}
                <div className="px-4 py-3 bg-gray-950 flex justify-between items-center border-t-2 border-gray-700">
                  <span className="text-gray-400 text-sm">{corteCaja.length} pagos cobrados</span>
                  <span className="text-emerald-400 font-black">${totalCobradoHoy.toLocaleString('es-MX')}</span>
                </div>
              </div>
            </>
          )}
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
