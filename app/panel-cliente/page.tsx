'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { InterestBreakdown } from '@/components/InterestBreakdown';

export default function PanelCliente() {
  const [datos, setDatos] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const id = localStorage.getItem('cliente_id');
    if (!id) { router.push('/login'); return; }

    const cargarDatos = async () => {
      try {
        // Traer datos del cliente con sus créditos
        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .single();

        if (clienteError) throw clienteError;
        if (!clienteData) throw new Error('Cliente no encontrado');

        // Traer créditos del cliente
        const { data: creditosData, error: creditosError } = await supabase
          .from('creditos')
          .select('*')
          .eq('cliente_id', id);

        if (creditosError) throw creditosError;

        // Traer perfil del cliente
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('nombre_completo')
          .eq('id', id)
          .single();

        if (profileError) throw profileError;

        // Combinar datos
        const datosCompletos = {
          ...clienteData,
          creditos: creditosData || [],
          profiles: profileData
        };

        setDatos(datosCompletos);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, [router]);

  const cerrarSesion = () => {
    localStorage.removeItem('cliente_id');
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-yellow-500">Cargando...</div>;

  const pestañasCredito = datos?.creditos?.map((credito: any, index: number) => {
    const plazoSemanas = credito.semanas_autorizadas || credito.plazo_semanas || 12;
    const totalDias = plazoSemanas * 5;
    const pagosRealizados = credito.pagos || [];
    const fechaInicio = new Date(credito.fecha_inicio || new Date());
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Calcular capital e interés por día
    const capitalPorDia = credito.monto_total / totalDias;
    const interesPorDia = (credito.interes_total || 0) / totalDias;

    // Calcular progreso en días
    const diasPagados = pagosRealizados.length;
    const diasPendientes = totalDias - diasPagados;
    const porcentajePagado = (diasPagados / totalDias) * 100;

    const cronograma = Array.from({ length: totalDias }, (_, i) => {
      const numeroDia = i + 1;
      let fechaActual = new Date(fechaInicio);
      let diasAgregados = 0;

      // Avanzar solo días hábiles
      while (diasAgregados < numeroDia) {
        const diaSemana = fechaActual.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) {
          diasAgregados++;
          if (diasAgregados === numeroDia) break;
        }
        fechaActual.setDate(fechaActual.getDate() + 1);
      }

      const pagoHecho = pagosRealizados.find((p: any) => p.numero_dia === numeroDia);
      const fechaPago = new Date(fechaActual);
      fechaPago.setHours(0, 0, 0, 0);
      const estAtrasado = !pagoHecho && fechaPago < hoy;

      return {
        dia: numeroDia,
        semana: Math.ceil(numeroDia / 5),
        fecha: fechaActual.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' }),
        monto: pagoHecho?.monto || credito.monto_diario,
        capital: capitalPorDia,
        interes: interesPorDia,
        pagado: !!pagoHecho,
        atrasado: estAtrasado,
        fechaCompleta: fechaPago
      };
    });

    // Filtrar pagos atrasados
    const pagosAtrasados = cronograma.filter(p => p.atrasado);

    return {
      id: `credito-${index}`,
      label: `Crédito #${index + 1}`,
      content: (
        <div className="space-y-4 w-full">
          {/* ALERTA DE PAGOS ATRASADOS */}
          {pagosAtrasados.length > 0 && (
            <div className="bg-red-950/50 border-2 border-red-600 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-exclamation-triangle text-red-500 text-xl"></i>
                <h3 className="text-red-400 font-black text-lg">⚠️ Pagos Atrasados</h3>
              </div>
              <div className="space-y-2">
                {pagosAtrasados.map((pago) => (
                  <div key={pago.dia} className="bg-red-900/30 p-3 rounded-lg border border-red-800">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-red-300 font-bold">Día {pago.dia}</p>
                        <p className="text-red-400 text-sm">{pago.fecha}</p>
                      </div>
                      <p className="text-red-500 font-black text-lg">${pago.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-red-300 text-sm font-bold">
                Total atrasado: ${pagosAtrasados.reduce((sum, p) => sum + p.monto, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}

          {/* Card Principal del Crédito */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-red-900/30 p-6 shadow-xl space-y-4">

            {/* Header del Card */}
            <div className="border-b border-gray-800 pb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest">Crédito Activo</p>
                  <p className="text-white font-black text-2xl">${credito.monto_total.toLocaleString('es-MX')}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase tracking-widest">Cuota Diaria</p>
                  <p className="text-yellow-500 font-black text-2xl">${credito.monto_diario.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            </div>

            {/* Desglose de Capital */}
            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 text-center">
              <p className="text-gray-400 text-[10px] uppercase font-bold">Monto</p>
              <p className="text-white font-black text-2xl">${credito.monto_total.toLocaleString('es-MX')}</p>
            </div>

            {/* Información General */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-800/30 p-3 rounded-lg">
                <p className="text-gray-500 text-xs uppercase mb-1">Plazo Total</p>
                <p className="text-white font-bold">{plazoSemanas} semanas ({totalDias} días)</p>
              </div>
              <div className="bg-gray-800/30 p-3 rounded-lg">
                <p className="text-gray-500 text-xs uppercase mb-1">Total a Pagar</p>
                <p className="text-white font-bold">${(credito.monto_total + (credito.interes_total || 0)).toLocaleString('es-MX')}</p>
              </div>
            </div>
          </div>

          {/* Progreso Visual */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-bold text-lg">Progreso de Pago</h3>
              <span className="text-yellow-500 font-black text-xl">{Math.round(porcentajePagado)}%</span>
            </div>

            {/* Barra de Progreso */}
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-500"
                style={{ width: `${porcentajePagado}%` }}
              ></div>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-900/20 border border-emerald-900/50 rounded-lg p-4 text-center">
                <p className="text-emerald-400 text-sm font-bold uppercase">Días Pagados</p>
                <p className="text-emerald-300 font-black text-3xl">{diasPagados}</p>
              </div>
              <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 text-center">
                <p className="text-red-400 text-sm font-bold uppercase">Días Pendientes</p>
                <p className="text-red-300 font-black text-3xl">{diasPendientes}</p>
              </div>
            </div>

            {/* Próximo Pago */}
            {diasPendientes > 0 && (
              <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4">
                <p className="text-blue-400 text-xs uppercase font-bold mb-1">Próximo Pago Vencido</p>
                <p className="text-white font-bold text-lg">
                  ${cronograma[diasPagados]?.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 }) || credito.monto_diario.toLocaleString('es-MX')}
                </p>
                <p className="text-gray-400 text-xs mt-1">Día {diasPagados + 1}</p>
              </div>
            )}
          </div>

          {/* Lista de Días */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-white font-bold">Calendario de Pagos</h3>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {cronograma.map((item) => (
                <div key={item.dia} className={`flex justify-between items-center p-4 border-b border-gray-800 last:border-0 transition-colors ${item.pagado ? 'bg-emerald-950/20' : item.atrasado ? 'bg-red-950/20' : 'hover:bg-gray-800/50'}`}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${item.pagado ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : item.atrasado ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-gray-600 text-gray-400'}`}>
                      {item.pagado ? <i className="fa-solid fa-check"></i> : item.atrasado ? <i className="fa-solid fa-exclamation"></i> : item.dia}
                    </div>
                    <div>
                      <p className="text-white font-bold">Día {item.dia} (Semana {item.semana})</p>
                      <p className={`text-xs ${item.atrasado ? 'text-red-400' : 'text-gray-500'}`}>{item.fecha}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-base ${item.pagado ? 'text-emerald-400' : item.atrasado ? 'text-red-400' : 'text-yellow-500'}`}>
                      ${item.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    };
  }) || [];

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-lg">
        {/* Header con espaciado para móvil */}
        <header className="flex justify-between items-center mb-6 px-2">
          <div>
            <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold">Bienvenido</p>
            <h1 className="text-xl font-black text-white">{datos?.profiles?.nombre_completo || 'Cliente'}</h1>
          </div>
          <button onClick={cerrarSesion} className="text-gray-500 hover:text-red-500 p-2">
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </header>

        <h3 className="text-white font-bold text-sm mb-4 px-2">Resumen de Créditos</h3>
        
        {pestañasCredito.length > 0 ? (
          <div className="w-full">
            <AnimatedTabs tabs={pestañasCredito} />
          </div>
        ) : (
          <p className="text-gray-500 text-center py-10">No tienes créditos activos.</p>
        )}
      </div>
    </main>
  );
}