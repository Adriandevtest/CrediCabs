'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ClientTable from '../components/ClientTable';
import ActionModal from '../components/ActionModal';
import { supabase } from '../lib/supabase';
import UserNav from '../components/UserNav';
import { LumaSpin } from '../components/luma-spin';

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
  const [totalMoraHoy, setTotalMoraHoy] = useState(0);
  const [metaHoy, setMetaHoy] = useState(0);
  const [totalPagosEsperados, setTotalPagosEsperados] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [capitalFlash, setCapitalFlash] = useState(false);
  const router = useRouter();

  const hoy = new Date();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const fechaHoyLabel = hoy.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    verificarAccesoYDatos();

    const channel = supabase
      .channel('admin-dashboard-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagos_diarios' }, (payload) => {
        if ((payload.new as any)?.pagado) {
          setCapitalFlash(true);
          setTimeout(() => setCapitalFlash(false), 1500);
        }
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

      // 2. Créditos activos → Capital pendiente (saldo real por cobrar), Clientes, ROI
      const { data: creditosData } = await supabase
        .from('creditos')
        .select('monto_total, monto_diario, interes_total, pagos_diarios(pagado)')
        .or('estado.eq.activo,estado.is.null,estado.eq.atrasado');

      if (creditosData) {
        // Capital pendiente = suma de pagos sin cobrar × cuota diaria
        // Se actualiza en tiempo real con cada pago registrado
        const totalCapital = (creditosData as any[]).reduce((s, c) => {
          const pendientes = (c.pagos_diarios || []).filter((p: any) => !p.pagado).length;
          return s + pendientes * Number(c.monto_diario || 0);
        }, 0);
        const totalInteres = (creditosData as any[]).reduce((s, c) => s + Number(c.interes_total || 0), 0);
        const roiPct = totalCapital > 0 ? (totalInteres / totalCapital) * 100 : 0;

        // Meta del día: todos los pagos esperados hoy
        const { data: pagosEsperadosHoy } = await supabase
          .from('pagos_diarios')
          .select('creditos(monto_diario)')
          .eq('fecha_esperada', fechaHoy);

        const meta = (pagosEsperadosHoy || []).reduce(
          (s: number, p: any) => s + Number(p.creditos?.monto_diario || 0), 0
        );
        setMetaHoy(Math.round(meta));
        setTotalPagosEsperados((pagosEsperadosHoy || []).length);

        setMetricas({
          capital: totalCapital,
          clientes: creditosData.length,
          cobroHoy: Math.round(meta),
          interesProyectado: totalInteres,
          roiPorcentaje: roiPct,
        });
      }

      // 3. Corte de caja: pagos cobrados hoy (fecha_esperada = hoy, pagado = true)
      //    Incluye mora cobrada y cobrador que registró el pago
      const { data: pagadosHoy } = await supabase
        .from('pagos_diarios')
        .select(`
          id, numero_dia, mora,
          creditos (
            monto_diario,
            pagos_diarios ( id ),
            clientes (
              numero_cliente,
              cobrador_asignado_id,
              profiles ( nombre_completo )
            )
          )
        `)
        .eq('pagado', true)
        .eq('fecha_esperada', fechaHoy)
        .order('numero_dia', { ascending: true });

      if (pagadosHoy) {
        // Obtener nombres de cobradores para mapear
        const cobIds = [...new Set(
          (pagadosHoy as any[])
            .map((p: any) => p.creditos?.clientes?.cobrador_asignado_id)
            .filter(Boolean)
        )];
        let cobNombreMap: Record<string, string> = {};
        if (cobIds.length > 0) {
          const { data: cobPerfiles } = await supabase
            .from('profiles')
            .select('id, nombre_completo')
            .in('id', cobIds);
          cobNombreMap = Object.fromEntries(
            (cobPerfiles || []).map((c: any) => [c.id, c.nombre_completo])
          );
        }

        const corteFinal = (pagadosHoy as any[]).map((p: any) => ({
          ...p,
          _cobrador: cobNombreMap[p.creditos?.clientes?.cobrador_asignado_id] || 'Sin asignar',
        }));

        setCorteCaja(corteFinal);
        const totalCuotas = corteFinal.reduce((s, p) => s + Number(p.creditos?.monto_diario || 0), 0);
        const totalMora = corteFinal.reduce((s, p) => s + Number(p.mora || 0), 0);
        setTotalCobradoHoy(Math.round(totalCuotas));
        setTotalMoraHoy(Math.round(totalMora));
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <LumaSpin />
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    );
  }

  const porcentajeMeta = metaHoy > 0 ? Math.min(100, Math.round((totalCobradoHoy / metaHoy) * 100)) : 0;

  return (
    <main className="min-h-screen bg-gray-950 pb-20">

      {/* ── HEADER MÓVIL sticky ── */}
      <header className="md:hidden sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-white leading-tight">Credi <span className="text-red-600">Cab's</span></h1>
          <p className="text-gray-500 text-[9px] uppercase tracking-widest">Admin Central</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full"
          >+ Nuevo</button>
          <UserNav />
        </div>
      </header>

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

        {/* Header escritorio */}
        <header className="hidden md:flex pt-0 pb-6 border-b border-red-900 justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-white">Credi <span className="text-red-600">Cab's</span></h1>
            <p className="text-gray-400 text-base tracking-widest uppercase">Admin Central</p>
          </div>
        </header>

        {/* Métricas principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 mt-6">
          <div className={`bg-gray-900 border-l-4 border-red-600 p-4 md:p-6 rounded-r-xl transition-colors duration-300 ${capitalFlash ? 'bg-emerald-950/40' : ''}`}>
            <div className="flex items-center gap-1.5">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider">Capital Pendiente</p>
              {capitalFlash && (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-900/50 px-1.5 py-0.5 rounded-full animate-pulse">
                  ↓ actualizado
                </span>
              )}
            </div>
            <p className={`text-xl md:text-3xl font-bold mt-1 transition-colors duration-500 ${capitalFlash ? 'text-emerald-400' : 'text-white'}`}>
              ${metricas.capital.toLocaleString('es-MX')}
            </p>
            <p className="text-gray-600 text-[10px] mt-1">saldo por cobrar · tiempo real</p>
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

          {/* Header */}
          <div className="px-4 md:px-6 py-4 border-b border-gray-800 bg-gray-950 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-lg">Corte de Caja</h2>
                <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full capitalize">{fechaHoyLabel}</span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">Pagos registrados hoy en todas las rutas</p>
            </div>

            {/* Progreso del día */}
            <div className="flex flex-col gap-1 md:min-w-[220px]">
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
              <p className="text-[10px] text-gray-500">
                {corteCaja.length} cobrados · {Math.max(0, totalPagosEsperados - corteCaja.length)} pendientes de {totalPagosEsperados} esperados hoy
              </p>
            </div>
          </div>

          {/* Resumen de totales cuando hay mora */}
          {totalMoraHoy > 0 && (
            <div className="px-4 md:px-6 py-3 border-b border-gray-800 bg-gray-900/50 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Cuotas</span>
                <span className="text-sm font-bold text-white">${totalCobradoHoy.toLocaleString('es-MX')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-red-400 uppercase tracking-wider">+ Mora</span>
                <span className="text-sm font-bold text-red-400">${totalMoraHoy.toLocaleString('es-MX')}</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Total</span>
                <span className="text-base font-black text-emerald-400">${(totalCobradoHoy + totalMoraHoy).toLocaleString('es-MX')}</span>
              </div>
            </div>
          )}

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
                      <th className="px-6 py-3 font-medium">Cobrador</th>
                      <th className="px-6 py-3 font-medium text-center">Pago</th>
                      <th className="px-6 py-3 font-medium text-right">Cuota</th>
                      <th className="px-6 py-3 font-medium text-right">Mora</th>
                      <th className="px-6 py-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {corteCaja.map((pago, i) => {
                      const cliente = pago.creditos?.clientes;
                      const cuota = Number(pago.creditos?.monto_diario || 0);
                      const mora = Number(pago.mora || 0);
                      const total = (pago.creditos?.pagos_diarios || []).length || 0;
                      return (
                        <tr key={pago.id} className={`hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-800/20'}`}>
                          <td className="px-6 py-3 text-white font-medium">
                            {cliente?.profiles?.nombre_completo || '—'}
                          </td>
                          <td className="px-6 py-3 text-yellow-500 font-mono text-xs">
                            {cliente?.numero_cliente || '—'}
                          </td>
                          <td className="px-6 py-3 text-gray-400 text-xs">
                            {pago._cobrador}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className="text-[11px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                              {pago.numero_dia} / {total}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-emerald-400 font-bold">
                            +${Math.round(cuota).toLocaleString('es-MX')}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {mora > 0
                              ? <span className="text-red-400 font-bold text-xs">+${mora.toLocaleString('es-MX')}</span>
                              : <span className="text-gray-700">—</span>
                            }
                          </td>
                          <td className="px-6 py-3 text-right text-white font-black">
                            ${Math.round(cuota + mora).toLocaleString('es-MX')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-700 bg-gray-950">
                      <td colSpan={4} className="px-6 py-3 text-gray-400 text-sm font-medium">
                        Total cobrado hoy ({corteCaja.length} pagos)
                      </td>
                      <td className="px-6 py-3 text-right text-emerald-400 font-black">
                        ${totalCobradoHoy.toLocaleString('es-MX')}
                      </td>
                      <td className="px-6 py-3 text-right text-red-400 font-black">
                        {totalMoraHoy > 0 ? `+$${totalMoraHoy.toLocaleString('es-MX')}` : '—'}
                      </td>
                      <td className="px-6 py-3 text-right text-white font-black text-lg">
                        ${(totalCobradoHoy + totalMoraHoy).toLocaleString('es-MX')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Lista móvil */}
              <div className="md:hidden divide-y divide-gray-800/60">
                {corteCaja.map((pago) => {
                  const cliente = pago.creditos?.clientes;
                  const cuota = Number(pago.creditos?.monto_diario || 0);
                  const mora = Number(pago.mora || 0);
                  const total = (pago.creditos?.pagos_diarios || []).length || 0;
                  return (
                    <div key={pago.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">
                            {cliente?.profiles?.nombre_completo || '—'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-yellow-500 font-mono text-[10px]">{cliente?.numero_cliente}</span>
                            <span className="text-gray-600 text-[10px]">·</span>
                            <span className="text-gray-500 text-[10px]">Pago {pago.numero_dia}/{total}</span>
                            <span className="text-gray-600 text-[10px]">·</span>
                            <span className="text-gray-400 text-[10px] truncate">{pago._cobrador}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-white font-black text-sm">
                            ${Math.round(cuota + mora).toLocaleString('es-MX')}
                          </p>
                          {mora > 0 && (
                            <p className="text-red-400 text-[10px]">+${mora.toLocaleString('es-MX')} mora</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="px-4 py-3 bg-gray-950 border-t-2 border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">{corteCaja.length} pagos cobrados</span>
                    <span className="text-white font-black">${(totalCobradoHoy + totalMoraHoy).toLocaleString('es-MX')}</span>
                  </div>
                  {totalMoraHoy > 0 && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-gray-500 text-[10px]">Cuotas + mora</span>
                      <span className="text-gray-400 text-[10px]">
                        ${totalCobradoHoy.toLocaleString('es-MX')} + ${totalMoraHoy.toLocaleString('es-MX')}
                      </span>
                    </div>
                  )}
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
