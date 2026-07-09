'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { MORA_POR_DIA } from '../../lib/mora';
import UserNav from '../../components/UserNav';
import GeoTracker from '../../components/GeoTracker';
import BottomSheet from '../../components/BottomSheet';

type GpsEstado = 'inactivo' | 'activo' | 'error' | 'sin_soporte';
type Tab = 'ruta' | 'historial' | 'mapa' | 'perfil';

const MapaUbicacionPropia = dynamic(
  () => import('../../components/MapaUbicacionPropia'),
  { ssr: false, loading: () => <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Cargando mapa...</div> }
);

export default function CobradorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('ruta');

  // ── Datos de ruta ──
  const [ruta, setRuta] = useState<any[]>([]);
  const [completados, setCompletados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesandoPago, setProcesandoPago] = useState<string | null>(null);

  // ── Perfil del usuario ──
  const [userId, setUserId] = useState<string | null>(null);
  const [nombreCobrador, setNombreCobrador] = useState('');
  const [telefonoCobrador, setTelefonoCobrador] = useState('');
  const [fotoCobrador, setFotoCobrador] = useState('');
  const [gpsEstado, setGpsEstado] = useState<GpsEstado>('inactivo');

  // ── Historial ──
  const [historial, setHistorial] = useState<any[]>([]);
  const [historialCargado, setHistorialCargado] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // ── Realtime ──
  const [rtActivo, setRtActivo] = useState(false);

  // ── Detalle hoja de pagos ──
  const [detalleCliente, setDetalleCliente] = useState<any | null>(null);
  const [tabDetalle, setTabDetalle] = useState<'perfil' | 'pagos'>('perfil');

  // ── Pago parcial / mora independiente ──
  const [montosInput, setMontosInput] = useState<Record<string, string>>({});
  const [montosMoraInput, setMontosMoraInput] = useState<Record<string, string>>({});
  const [pagandoMora, setPagandoMora] = useState<string | null>(null);

  // ── Confirmación de acciones ──
  const [confirmacion, setConfirmacion] = useState<{
    tipo: 'pago' | 'mora';
    clienteNombre: string;
    monto: number;
    onConfirmar: () => void;
  } | null>(null);

  const router = useRouter();
  const today = new Date().toLocaleDateString('en-CA');
  const fechaHoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });


  // ────────────────────────────────────────────
  // Inicialización
  // ────────────────────────────────────────────
  // Sincronizar activeTab con el hash de la URL (controlado por MobileNav)
  useEffect(() => {
    const readHash = () => {
      const h = window.location.hash.slice(1) as Tab;
      const valid: Tab[] = ['ruta', 'historial', 'mapa', 'perfil'];
      setActiveTab(valid.includes(h) ? h : 'ruta');
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  useEffect(() => {
    cargarRutaDelDia();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`cobrador-rt-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'creditos' }, (payload) => {
        const updated = payload.new as any;
        setRuta((prev) =>
          prev.map((c) => c._creditoId === updated.id
            ? { ...c, _credito: { ...c._credito, estado: updated.estado } }
            : c
          )
        );
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagos_diarios' }, (payload) => {
        const pago = payload.new as any;
        if (!pago.pagado) return;
        setRuta((prev) => {
          const entry = prev.find((c) => c._creditoId === pago.credito_id);
          if (!entry) return prev;
          setCompletados((comp) => comp.some((x) => x._entryKey === entry._entryKey) ? comp : [...comp, entry]);
          return prev.filter((c) => c._entryKey !== entry._entryKey);
        });
      })
      .subscribe((status) => setRtActivo(status === 'SUBSCRIBED'));

    // Broadcast: recibe señal del API cuando admin aprueba una transferencia
    const chBc = supabase
      .channel(`pagos-cobrador-${userId}`)
      .on('broadcast', { event: 'pago_aprobado' }, () => {
        cargarRutaDelDia();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(chBc);
    };
  }, [userId]);

  // Cargar historial al entrar al tab por primera vez
  useEffect(() => {
    if (activeTab === 'historial' && !historialCargado && userId) {
      cargarHistorial();
    }
  }, [activeTab, userId]);

  // ────────────────────────────────────────────
  // Funciones de datos
  // ────────────────────────────────────────────
  const cargarRutaDelDia = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data: perfil } = await supabase
        .from('profiles')
        .select('nombre_completo, telefono, foto_url, avatar_url')
        .eq('id', user.id)
        .single();

      if (perfil) {
        setNombreCobrador(perfil.nombre_completo?.split(' ')[0] || '');
        setTelefonoCobrador(perfil.telefono || '');
        setFotoCobrador(perfil.foto_url || perfil.avatar_url || '');
      }

      const { data, error } = await supabase
        .from('clientes')
        .select(`
          id, numero_cliente, direccion,
          profiles (nombre_completo, telefono, email),
          creditos (
            id, monto_diario, estado, monto_total, interes_total, tasa_interes_porcentaje,
            pagos_diarios (id, pagado, fecha_esperada, numero_dia, mora, monto_pagado)
          )
        `)
        .eq('cobrador_asignado_id', user.id)
        .order('numero_cliente', { ascending: true });

      if (error) throw error;

      // Aplanar a una entrada por crédito activo (un cliente puede tener varios)
      const pendientes: any[] = [];
      const pagadosHoy: any[] = [];

      (data || []).forEach((cliente) => {
        const creditosActivos = (cliente.creditos || []).filter(
          (c: any) => c.estado !== 'liquidado'
        );
        const tieneMultiples = creditosActivos.length > 1;
        creditosActivos.forEach((credito: any, idx: number) => {
          const entry = {
            ...cliente,
            _entryKey: `${cliente.id}_${credito.id}`,
            _creditoId: credito.id,
            _credito: credito,
            _multiCredito: tieneMultiples,
            _creditoNumero: idx + 1,
          };
          // Pagos vencidos (fecha <= hoy)
          const vencidos = (credito.pagos_diarios || []).filter(
            (p: any) => p.fecha_esperada <= today
          );
          // Si todos los vencidos están pagados → completado hoy
          const alDia = vencidos.length > 0 && vencidos.every((p: any) => p.pagado);
          if (alDia) pagadosHoy.push(entry);
          else if (vencidos.some((p: any) => !p.pagado)) pendientes.push(entry);
        });
      });

      setRuta(pendientes);
      setCompletados(pagadosHoy);
    } catch (e) {
      console.error('Error al cargar ruta:', e);
    } finally {
      setLoading(false);
    }
  };

  const cargarHistorial = async () => {
    if (!userId) return;
    setLoadingHistorial(true);
    try {
      const { data } = await supabase
        .from('clientes')
        .select(`
          id, numero_cliente,
          profiles (nombre_completo),
          creditos (
            monto_diario, semanas_autorizadas,
            pagos_diarios (id, numero_dia, fecha_esperada, pagado)
          )
        `)
        .eq('cobrador_asignado_id', userId);

      if (data) {
        const todos: any[] = [];
        data.forEach((cliente) => {
          (cliente.creditos || []).forEach((cred: any) => {
            (cred.pagos_diarios || [])
              .filter((p: any) => p.pagado)
              .forEach((pago: any) => {
                todos.push({
                  ...pago,
                  cliente_nombre: (cliente.profiles as any)?.nombre_completo,
                  numero_cliente: cliente.numero_cliente,
                  monto_diario: cred.monto_diario,
                  total_pagos: cred.semanas_autorizadas,
                });
              });
          });
        });
        todos.sort((a, b) => b.fecha_esperada.localeCompare(a.fecha_esperada));
        setHistorial(todos);
      }
    } finally {
      setHistorialCargado(true);
      setLoadingHistorial(false);
    }
  };

  const registrarPago = async (entryKey: string, creditoId: string, montoCobrado: number) => {
    if (montoCobrado <= 0) { alert('Ingresa un monto válido.'); return; }
    setProcesandoPago(creditoId);
    try {
      const { data: pagosDebidos, error: findError } = await supabase
        .from('pagos_diarios')
        .select('id, fecha_esperada, monto_pagado')
        .eq('credito_id', creditoId)
        .eq('pagado', false)
        .lte('fecha_esperada', today)
        .order('numero_dia', { ascending: true });

      if (findError || !pagosDebidos || pagosDebidos.length === 0) {
        throw new Error('No hay pagos pendientes.');
      }

      const entry = ruta.find((c) => c._entryKey === entryKey);
      const cuotaBase = entry?._credito?.monto_diario || 0;

      let montoRestante = montoCobrado;
      const updatedPagos = new Map<string, Partial<{ pagado: boolean; monto_pagado: number }>>();

      for (const pago of pagosDebidos) {
        if (montoRestante <= 0) break;

        const yaAbonado = Number(pago.monto_pagado) || 0;
        const pendienteEste = cuotaBase - yaAbonado;
        if (pendienteEste <= 0) continue;

        if (montoRestante >= pendienteEste) {
          const { error } = await supabase.from('pagos_diarios')
            .update({ pagado: true, monto_pagado: cuotaBase })
            .eq('id', pago.id);
          if (error) throw error;
          updatedPagos.set(pago.id, { pagado: true, monto_pagado: cuotaBase });
          montoRestante -= pendienteEste;
        } else {
          const nuevoAbonado = yaAbonado + montoRestante;
          const { error } = await supabase.from('pagos_diarios')
            .update({ monto_pagado: nuevoAbonado })
            .eq('id', pago.id);
          if (error) throw error;
          updatedPagos.set(pago.id, { monto_pagado: nuevoAbonado });
          montoRestante = 0;
        }
      }

      // Si no quedan más pagos pendientes, marcar el crédito como liquidado
      const { count: pendientes } = await supabase
        .from('pagos_diarios')
        .select('id', { count: 'exact', head: true })
        .eq('credito_id', creditoId)
        .eq('pagado', false);
      if (pendientes === 0) {
        await supabase.from('creditos').update({ estado: 'liquidado' }).eq('id', creditoId);
      }

      // ¿Todos los vencidos quedaron pagados?
      const allDuePaid = pagosDebidos.every((p) => updatedPagos.get(p.id)?.pagado === true);

      if (allDuePaid) {
        if (entry) {
          setCompletados((prev) => [...prev, entry]);
          setRuta((prev) => prev.filter((c) => c._entryKey !== entryKey));
          const clienteNombre = (entry.profiles as any)?.nombre_completo || `Cliente ${entry.numero_cliente}`;
          fetch('/api/notifications/pago-registrado', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clienteNombre, monto: montoCobrado }),
          }).catch(() => {});
        }
      } else {
        // Abono parcial — actualizar estado local sin recargar
        setRuta((prev) => prev.map((c) => {
          if (c._entryKey !== entryKey) return c;
          return {
            ...c,
            _credito: {
              ...c._credito,
              pagos_diarios: (c._credito.pagos_diarios || []).map((p: any) => {
                const updated = updatedPagos.get(p.id);
                return updated ? { ...p, ...updated } : p;
              }),
            },
          };
        }));
      }

      // Limpiar input
      setMontosInput((prev) => { const n = { ...prev }; delete n[entryKey]; return n; });
    } catch (e: any) {
      alert('Error al registrar pago: ' + e.message);
    } finally {
      setProcesandoPago(null);
    }
  };

  const cobrarMora = async (creditoId: string, montoMora: number) => {
    if (montoMora <= 0) { alert('Ingresa un monto de mora válido.'); return; }
    setPagandoMora(creditoId);
    try {
      const { data: atrasados, error } = await supabase
        .from('pagos_diarios')
        .select('id, mora, fecha_esperada')
        .eq('credito_id', creditoId)
        .eq('pagado', false)
        .lt('fecha_esperada', today)
        .order('fecha_esperada', { ascending: true });

      if (error) throw error;

      const pendientes = (atrasados || []).filter((p) => (Number(p.mora) || 0) < MORA_POR_DIA);
      if (pendientes.length === 0) { alert('No hay mora pendiente de cobrar.'); return; }

      let montoRestante = montoMora;
      const actualizados = new Map<string, number>();

      for (const pago of pendientes) {
        if (montoRestante <= 0) break;
        const yaAbonado = Number(pago.mora) || 0;
        const pendienteEste = MORA_POR_DIA - yaAbonado;
        const abono = Math.min(montoRestante, pendienteEste);
        const nuevoMora = yaAbonado + abono;

        const { error: upErr } = await supabase
          .from('pagos_diarios')
          .update({ mora: nuevoMora })
          .eq('id', pago.id);
        if (upErr) throw upErr;

        actualizados.set(pago.id, nuevoMora);
        montoRestante -= abono;
      }

      setRuta((prev) => prev.map((c) => {
        if (c._creditoId !== creditoId) return c;
        return {
          ...c,
          _credito: {
            ...c._credito,
            pagos_diarios: (c._credito.pagos_diarios || []).map((p: any) =>
              actualizados.has(p.id) ? { ...p, mora: actualizados.get(p.id) } : p
            ),
          },
        };
      }));

      setMontosMoraInput((prev) => { const n = { ...prev }; delete n[creditoId]; return n; });
    } catch (e: any) {
      alert('Error al cobrar mora: ' + e.message);
    } finally {
      setPagandoMora(null);
    }
  };

  const cerrarSesion = () => {
    supabase.auth.signOut();
    window.location.href = '/login';
  };

  // ────────────────────────────────────────────
  // Métricas
  // ────────────────────────────────────────────
  const totalDia = [...ruta, ...completados].reduce((a, c) => a + (c._credito?.monto_diario || 0), 0);
  const totalCobrado = completados.reduce((a, c) => a + (c._credito?.monto_diario || 0), 0);
  const totalPendiente = ruta.reduce((a, c) => a + (c._credito?.monto_diario || 0), 0);
  const morasPendientes = ruta.reduce((a, c) => {
    const pagos = c._credito?.pagos_diarios || [];
    const atrasados = pagos.filter((p: any) => !p.pagado && p.fecha_esperada < today);
    const abonado = atrasados.reduce((s: number, p: any) => s + (Number(p.mora) || 0), 0);
    return a + Math.max(0, atrasados.length * MORA_POR_DIA - abonado);
  }, 0);
  const progreso = ruta.length + completados.length > 0
    ? Math.round((completados.length / (ruta.length + completados.length)) * 100)
    : 0;

  // Agrupar historial por fecha
  const historialPorFecha: Record<string, any[]> = {};
  historial.forEach((p) => {
    if (!historialPorFecha[p.fecha_esperada]) historialPorFecha[p.fecha_esperada] = [];
    historialPorFecha[p.fecha_esperada].push(p);
  });
  const fechasHistorial = Object.keys(historialPorFecha).sort((a, b) => b.localeCompare(a));

  const gpsInfo: Record<GpsEstado, { label: string; color: string; bg: string }> = {
    activo: { label: 'GPS activo — ubicación en vivo', color: 'text-blue-400', bg: 'bg-blue-950/30' },
    inactivo: { label: 'Iniciando GPS...', color: 'text-gray-500', bg: 'bg-gray-800/60' },
    error: { label: 'No se pudo obtener ubicación', color: 'text-red-400', bg: 'bg-red-950/30' },
    sin_soporte: { label: 'GPS no disponible en este dispositivo', color: 'text-gray-500', bg: 'bg-gray-800/60' },
  };

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-20 bg-gray-950">

      {/* GeoTracker invisible — sólo rastrea */}
      {userId && <GeoTracker userId={userId} onStatusChange={setGpsEstado} />}

      {/* ── HEADER FIJO ── */}
      <header className="bg-gray-950/95 backdrop-blur border-b border-gray-800 sticky top-0 z-50 px-4 pt-4 pb-3">
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-medium text-white">
                Hola, <span className="text-red-500">{nombreCobrador || 'Cobrador'}</span>
              </h1>
              <span
                className={`w-2 h-2 rounded-full ${rtActivo ? 'bg-green-500' : 'bg-gray-600'}`}
                title={rtActivo ? 'Tiempo real activo' : 'Conectando...'}
              />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">{fechaHoy} · Ruta del día</p>
          </div>
          <UserNav />
        </div>

        {/* Progreso — solo visible en tab Ruta */}
        {activeTab === 'ruta' && (
          <>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-red-600 rounded-full transition-all duration-500" style={{ width: `${progreso}%` }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-gray-500">
                {completados.length} de {ruta.length + completados.length} cobros completados
              </span>
              <span className="text-xs text-red-500 font-medium">{progreso}%</span>
            </div>
          </>
        )}
      </header>

      {/* ── CONTENIDO POR TAB ── */}
      <div className="px-4 pt-4 max-w-md mx-auto">

        {/* ════ TAB: RUTA ════ */}
        {activeTab === 'ruta' && (
          <>
            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Meta</p>
                <p className="text-lg font-semibold text-red-500">${Math.round(totalDia).toLocaleString('es-MX')}</p>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Cobrado</p>
                <p className="text-lg font-semibold text-emerald-400">${Math.round(totalCobrado).toLocaleString('es-MX')}</p>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Pendiente</p>
                <p className="text-lg font-semibold text-white">${Math.round(totalPendiente + morasPendientes).toLocaleString('es-MX')}</p>
                {morasPendientes > 0 && <p className="text-[9px] text-red-400 font-medium">+${morasPendientes} mora</p>}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-500 text-sm">Cargando ruta...</div>
            ) : ruta.length === 0 && completados.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 text-center py-12 px-6">
                <p className="text-3xl mb-3">📭</p>
                <h3 className="text-gray-300 font-medium">Sin clientes asignados</h3>
                <p className="text-gray-500 text-sm mt-1">No tienes clientes en tu ruta.</p>
              </div>
            ) : (
              <>
                {/* Pendientes */}
                {ruta.length > 0 && (
                  <>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
                      Clientes pendientes ({ruta.length})
                    </p>
                    <div className="flex flex-col gap-3 mb-6">
                      {ruta.map((cliente) => {
                        const credito = cliente._credito;
                        if (!credito) return null;
                        const isProcessing = procesandoPago === cliente._creditoId;
                        const atrasado = credito?.estado === 'atrasado';

                        const pagosVencidos = (credito.pagos_diarios || []).filter(
                          (p: any) => !p.pagado && p.fecha_esperada <= today
                        );
                        const pagosAtrasadosLocales = pagosVencidos.filter((p: any) => p.fecha_esperada < today);
                        const diasPagar = pagosVencidos.length;
                        const totalCuotas = Math.round(credito.monto_diario) * diasPagar;
                        const yaAbonado = pagosVencidos.reduce((s: number, p: any) => s + (Number(p.monto_pagado) || 0), 0);
                        const cuotaPendiente = Math.max(0, totalCuotas - yaAbonado);
                        const moraYaAbonada = pagosAtrasadosLocales.reduce((s: number, p: any) => s + (Number(p.mora) || 0), 0);
                        const moraPendiente = Math.max(0, pagosAtrasadosLocales.length * MORA_POR_DIA - moraYaAbonada);

                        const pagosOrdenados = [...(credito.pagos_diarios || [])].sort(
                          (a: any, b: any) => a.numero_dia - b.numero_dia
                        );
                        const nextPago = pagosOrdenados.find((p: any) => !p.pagado);
                        const numeroPago = nextPago?.numero_dia;
                        const totalPagos = pagosOrdenados.length;

                        return (
                          <div
                            key={cliente._entryKey}
                            className={`bg-gray-900 rounded-2xl p-4 border ${atrasado ? 'border-red-900/50 bg-red-950/20' : 'border-gray-800'}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs text-gray-500 font-mono">#{cliente.numero_cliente}</span>
                                  {cliente._multiCredito && (
                                    <span className="text-[9px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                                      Crédito {cliente._creditoNumero}
                                    </span>
                                  )}
                                  {numeroPago && (
                                    <span className="text-[9px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                                      Pago {numeroPago}/{totalPagos}
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-base font-semibold text-white leading-tight mt-0.5 truncate">
                                  {cliente.profiles?.nombre_completo}
                                </h3>
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${atrasado ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                  {atrasado ? '⚠ Atrasado' : '✓ Activo'}
                                </span>
                                <a
                                  href={`tel:${cliente.profiles?.telefono || ''}`}
                                  className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-gray-500 hover:text-green-400 hover:border-green-700 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                                  </svg>
                                </a>
                              </div>
                            </div>

                            {cliente.direccion && (
                              <div className="flex items-start gap-1.5 mb-3">
                                <svg className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <p className="text-xs text-gray-500 leading-snug">{cliente.direccion}</p>
                              </div>
                            )}

                            {/* Cuota */}
                            <div className={`rounded-xl p-3 mb-3 ${moraPendiente > 0 ? 'bg-red-950/30 border border-red-900/50' : 'bg-gray-800/60'}`}>
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                                    {diasPagar > 1 ? `${diasPagar} cuotas pendientes` : 'Cuota del día'}
                                  </p>
                                  {yaAbonado > 0 && (
                                    <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                                      Abonado ${yaAbonado.toLocaleString('es-MX')} · Resta ${cuotaPendiente.toLocaleString('es-MX')}
                                    </p>
                                  )}
                                </div>
                                <p className="text-xl font-semibold text-red-500">${cuotaPendiente.toLocaleString('es-MX')}</p>
                              </div>
                              {moraPendiente > 0 && (
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-red-900/40">
                                  <p className="text-xs text-red-400 uppercase tracking-wider font-bold">
                                    Mora ({pagosAtrasadosLocales.length} día{pagosAtrasadosLocales.length === 1 ? '' : 's'} atrasado{pagosAtrasadosLocales.length === 1 ? '' : 's'}) — cobrar aparte
                                  </p>
                                  <p className="text-sm font-bold text-red-500">+${moraPendiente.toLocaleString('es-MX')}</p>
                                </div>
                              )}
                            </div>

                            {/* Input de monto de mora */}
                            {moraPendiente > 0 && (
                              <div className="mb-3">
                                <label className="text-[10px] text-red-400 uppercase tracking-wider mb-1 block">Monto de mora a cobrar</label>
                                <div className="flex items-center bg-gray-800 border border-red-900/50 rounded-xl overflow-hidden">
                                  <span className="pl-3 text-red-400 text-sm font-medium">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="flex-1 px-2 py-2.5 bg-transparent text-white font-semibold text-sm outline-none"
                                    value={montosMoraInput[cliente._creditoId] !== undefined ? montosMoraInput[cliente._creditoId] : moraPendiente}
                                    onChange={(e) => setMontosMoraInput((prev) => ({ ...prev, [cliente._creditoId]: e.target.value }))}
                                  />
                                  {montosMoraInput[cliente._creditoId] !== undefined && Number(montosMoraInput[cliente._creditoId]) !== moraPendiente && (
                                    <button
                                      type="button"
                                      onClick={() => setMontosMoraInput((prev) => ({ ...prev, [cliente._creditoId]: String(moraPendiente) }))}
                                      className="px-2.5 py-2 text-[10px] text-red-400 font-bold border-l border-red-900/50 whitespace-nowrap"
                                    >
                                      Total
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Input de monto recibido */}
                            <div className="mb-3">
                              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Monto recibido</label>
                              <div className="flex items-center bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                                <span className="pl-3 text-gray-500 text-sm font-medium">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="flex-1 px-2 py-2.5 bg-transparent text-white font-semibold text-sm outline-none"
                                  value={montosInput[cliente._entryKey] !== undefined ? montosInput[cliente._entryKey] : cuotaPendiente}
                                  onChange={(e) => setMontosInput((prev) => ({ ...prev, [cliente._entryKey]: e.target.value }))}
                                />
                                {montosInput[cliente._entryKey] !== undefined && Number(montosInput[cliente._entryKey]) !== cuotaPendiente && (
                                  <button
                                    type="button"
                                    onClick={() => setMontosInput((prev) => ({ ...prev, [cliente._entryKey]: String(cuotaPendiente) }))}
                                    className="px-2.5 py-2 text-[10px] text-red-400 font-bold border-l border-gray-700 whitespace-nowrap"
                                  >
                                    Total
                                  </button>
                                )}
                              </div>
                            </div>

                            {credito.interes_total > 0 && (
                              <div className="rounded-xl p-3 mb-3 bg-amber-950/20 border border-amber-900/40">
                                <p className="text-xs text-amber-500 uppercase tracking-wider font-medium mb-2">Desglose diario</p>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Capital/día</span>
                                  <span className="text-gray-300 font-medium">
                                    ${((credito.monto_total / (credito.monto_total + credito.interes_total)) * credito.monto_diario).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs mt-1">
                                  <span className="text-amber-500">+ Interés/día</span>
                                  <span className="text-amber-400 font-medium">
                                    ${((credito.interes_total / (credito.monto_total + credito.interes_total)) * credito.monto_diario).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            )}

                            <div className="flex flex-col gap-2">
                              {moraPendiente > 0 && (
                                <button
                                  onClick={() => {
                                    const inputStr = montosMoraInput[cliente._creditoId];
                                    const monto = inputStr !== undefined && inputStr !== '' ? Number(inputStr) : moraPendiente;
                                    setConfirmacion({
                                      tipo: 'mora',
                                      clienteNombre: cliente.profiles?.nombre_completo || '',
                                      monto,
                                      onConfirmar: () => { setConfirmacion(null); cobrarMora(cliente._creditoId, monto); },
                                    });
                                  }}
                                  disabled={pagandoMora === cliente._creditoId}
                                  className="w-full border-2 border-red-800 text-red-400 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:bg-red-950/40 disabled:opacity-50 transition-colors"
                                >
                                  {pagandoMora === cliente._creditoId
                                    ? 'Registrando mora...'
                                    : 'Cobrar mora'}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const inputStr = montosInput[cliente._entryKey];
                                  const monto = inputStr !== undefined && inputStr !== '' ? Number(inputStr) : cuotaPendiente;
                                  setConfirmacion({
                                    tipo: 'pago',
                                    clienteNombre: cliente.profiles?.nombre_completo || '',
                                    monto,
                                    onConfirmar: () => { setConfirmacion(null); registrarPago(cliente._entryKey, cliente._creditoId, monto); },
                                  });
                                }}
                                disabled={isProcessing || cuotaPendiente <= 0}
                                className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-60 transition-colors text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                              >
                                {isProcessing ? (
                                  <span className="animate-pulse">Procesando...</span>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Registrar pago
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => { setDetalleCliente(cliente); setTabDetalle('perfil'); }}
                                className="w-full py-2 border border-gray-700 text-gray-500 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 hover:bg-gray-800 active:bg-gray-700 transition-colors"
                              >
                                <i className="fa-solid fa-user text-xs" />
                                Ver perfil del cliente
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {ruta.length === 0 && completados.length > 0 && (
                  <div className="bg-gray-900 rounded-2xl border border-gray-800 text-center py-8 px-6 mb-6">
                    <p className="text-3xl mb-2">🎉</p>
                    <h3 className="text-gray-300 font-semibold">¡Ruta completada!</h3>
                    <p className="text-gray-500 text-sm mt-1">Cobraste los {completados.length} clientes de hoy.</p>
                  </div>
                )}

                {completados.length > 0 && (
                  <>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
                      Pagados hoy ({completados.length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {completados.map((cliente) => {
                        const credito = cliente._credito;
                        return (
                          <div key={cliente._entryKey} className="bg-emerald-950/20 border border-emerald-900/40 rounded-2xl p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-200 truncate">{cliente.profiles?.nombre_completo}</p>
                                <p className="text-xs text-gray-500">
                                  #{cliente.numero_cliente}{cliente.direccion ? ` · ${cliente.direccion.split(',')[0]}` : ''}
                                </p>
                              </div>
                            </div>
                            <p className="text-emerald-400 font-bold text-sm shrink-0">
                              +${Math.round(credito?.monto_diario || 0).toLocaleString('es-MX')}
                            </p>
                            <button
                              onClick={() => { setDetalleCliente(cliente); setTabDetalle('perfil'); }}
                              className="shrink-0 w-8 h-8 rounded-full border border-emerald-800 flex items-center justify-center text-emerald-400 hover:bg-emerald-900/40 active:bg-emerald-900/60 transition-colors"
                              title="Ver perfil del cliente"
                            >
                              <i className="fa-solid fa-user text-xs" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ════ TAB: HISTORIAL ════ */}
        {activeTab === 'historial' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-bold text-base">Mis Cobros</h2>
                <p className="text-gray-500 text-xs">Historial de pagos registrados por ti</p>
              </div>
              {historialCargado && (
                <button onClick={cargarHistorial} className="text-gray-500 hover:text-red-400 transition-colors" title="Actualizar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {loadingHistorial ? (
              <div className="text-center py-16 text-gray-500 text-sm">Cargando historial...</div>
            ) : historial.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 text-center py-12 px-6">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-gray-300 font-medium">Sin cobros registrados aún</p>
                <p className="text-gray-500 text-sm mt-1">Aquí verás todos tus pagos anteriores.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {fechasHistorial.map((fecha) => {
                  const pagosDelDia = historialPorFecha[fecha];
                  const totalFecha = pagosDelDia.reduce((s: number, p: any) => s + Number(p.monto_diario || 0), 0);
                  const label = new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                    weekday: 'long', day: 'numeric', month: 'short',
                  });
                  const esHoy = fecha === today;

                  return (
                    <div key={fecha} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                      {/* Cabecera de fecha */}
                      <div className={`px-4 py-2.5 flex justify-between items-center ${esHoy ? 'bg-red-950/30 border-b border-red-900/40' : 'bg-gray-800/60 border-b border-gray-800'}`}>
                        <p className={`text-xs font-semibold capitalize ${esHoy ? 'text-red-400' : 'text-gray-400'}`}>
                          {esHoy ? '▶ Hoy · ' : ''}{label}
                        </p>
                        <span className={`text-xs font-bold ${esHoy ? 'text-red-400' : 'text-emerald-400'}`}>
                          +${Math.round(totalFecha).toLocaleString('es-MX')}
                        </span>
                      </div>

                      {/* Pagos del día */}
                      <div className="divide-y divide-gray-800">
                        {pagosDelDia.map((pago: any) => (
                          <div key={pago.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0">
                                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-200 leading-tight">{pago.cliente_nombre}</p>
                                <p className="text-[10px] text-gray-500">
                                  #{pago.numero_cliente} · Pago {pago.numero_dia}/{pago.total_pagos}
                                </p>
                              </div>
                            </div>
                            <p className="text-emerald-400 font-semibold text-sm shrink-0">
                              +${Math.round(pago.monto_diario).toLocaleString('es-MX')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ TAB: MAPA ════ */}
        {activeTab === 'mapa' && (
          <div>
            <div className="mb-4">
              <h2 className="text-white font-bold text-base">Mi Ubicación</h2>
              <p className="text-gray-500 text-xs">Tu posición GPS en tiempo real</p>
            </div>

            {/* Estado GPS */}
            <div className={`rounded-2xl p-3 flex items-center gap-3 mb-4 ${gpsInfo[gpsEstado].bg}`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${gpsEstado === 'activo' ? 'bg-blue-500 animate-pulse' : gpsEstado === 'error' ? 'bg-red-400' : 'bg-gray-400'}`} />
              <p className={`text-sm font-medium ${gpsInfo[gpsEstado].color}`}>{gpsInfo[gpsEstado].label}</p>
            </div>

            {userId && <MapaUbicacionPropia userId={userId} />}
          </div>
        )}

        {/* ════ TAB: PERFIL ════ */}
        {activeTab === 'perfil' && (
          <div>
            <div className="mb-4">
              <h2 className="text-white font-bold text-base">Mi Perfil</h2>
            </div>

            {/* Avatar + datos */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-4">
              <div className="flex items-center gap-4 mb-4">
                {fotoCobrador ? (
                  <img
                    src={fotoCobrador}
                    alt={nombreCobrador}
                    className="w-14 h-14 rounded-full object-cover border-2 border-red-500 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-xl shrink-0">
                    {(nombreCobrador || 'C')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-white font-bold text-base leading-tight">{nombreCobrador || 'Cobrador'}</p>
                  <span className="text-xs text-white bg-red-600 px-2 py-0.5 rounded-full font-medium">Cobrador</span>
                </div>
              </div>

              {telefonoCobrador && (
                <a href={`tel:${telefonoCobrador}`} className="flex items-center gap-3 py-2.5 border-t border-gray-800">
                  <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Teléfono</p>
                    <p className="text-gray-300 text-sm">{telefonoCobrador}</p>
                  </div>
                </a>
              )}

              {/* GPS status */}
              <div className="flex items-center gap-3 py-2.5 border-t border-gray-800">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rastreo GPS</p>
                  <p className={`text-sm font-medium ${gpsInfo[gpsEstado].color}`}>{gpsInfo[gpsEstado].label}</p>
                </div>
              </div>
            </div>

            {/* Resumen del día */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Resumen de hoy</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500">Cobros realizados</p>
                  <p className="text-xl font-bold text-white">{completados.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Total cobrado</p>
                  <p className="text-xl font-bold text-emerald-400">${Math.round(totalCobrado).toLocaleString('es-MX')}</p>
                </div>
              </div>
            </div>

            {/* Cerrar sesión */}
            <button
              onClick={cerrarSesion}
              className="w-full border-2 border-red-900/50 text-red-400 py-3 rounded-xl text-sm font-semibold active:bg-red-950/30 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}

      </div>

      {/* ── CONFIRMACIÓN DE PAGO / MORA ── */}
      {confirmacion && (
        <BottomSheet
          onClose={() => setConfirmacion(null)}
          bg="bg-gray-950"
          handleColor="bg-gray-700"
          overlayBg="bg-black/60 backdrop-blur-sm"
          overlayZ={120}
          sheetZ={121}
          maxHeight="70dvh"
        >
          <div className="px-5 pb-6">
            <p className="text-center text-gray-500 text-[11px] uppercase tracking-widest mb-1">
              {confirmacion.tipo === 'pago' ? '¿Registrar pago?' : '¿Registrar mora?'}
            </p>
            <p className="text-center font-bold text-white text-base leading-tight mb-1">
              {confirmacion.clienteNombre}
            </p>
            <p className="text-center text-3xl font-black text-red-500 mb-6">
              ${confirmacion.monto.toLocaleString('es-MX')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmacion(null)}
                className="flex-1 py-3.5 border-2 border-gray-700 text-gray-400 font-semibold rounded-2xl text-sm active:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmacion.onConfirmar}
                className={`flex-1 py-3.5 font-bold rounded-2xl text-sm text-white active:opacity-80 transition-opacity ${
                  confirmacion.tipo === 'pago' ? 'bg-red-600' : 'bg-red-500'
                }`}
              >
                {confirmacion.tipo === 'pago' ? 'Confirmar pago' : 'Confirmar mora'}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ── MODAL PERFIL / HOJA DE PAGOS ── */}
      {detalleCliente && (() => {
        const credito = detalleCliente._credito;
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const perfil = detalleCliente.profiles || {};

        const cronograma = [...(credito.pagos_diarios || [])]
          .sort((a: any, b: any) => a.numero_dia - b.numero_dia)
          .map((pago: any) => {
            const f = new Date(pago.fecha_esperada + 'T00:00:00'); f.setHours(0, 0, 0, 0);
            const esHoy = f.getTime() === hoy.getTime();
            const montoPagado = Number(pago.monto_pagado) || 0;
            const parcial = !pago.pagado && montoPagado > 0;
            return {
              numero: pago.numero_dia,
              fecha: f.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' }),
              pagado: !!pago.pagado,
              atrasado: !pago.pagado && f < hoy && !esHoy,
              esHoy, parcial, montoPagado,
              mora: Number(pago.mora) || 0,
            };
          });

        const pagados    = cronograma.filter(p => p.pagado).length;
        const parciales  = cronograma.filter(p => p.parcial).length;
        const total      = cronograma.length;
        const atrasados  = cronograma.filter(p => p.atrasado && !p.parcial).length;
        const porcentaje = total > 0 ? Math.round((pagados / total) * 100) : 0;
        const iniciales  = perfil.nombre_completo
          ? perfil.nombre_completo.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
          : '?';

        return (
          <BottomSheet onClose={() => setDetalleCliente(null)} bg="bg-gray-950" handleColor="bg-gray-700" overlayZ={110} sheetZ={111} maxHeight="92dvh">

              {/* Header compacto */}
              <div className="px-5 pt-1 pb-3 shrink-0 border-b border-gray-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-900/30 text-red-400 flex items-center justify-center font-black text-sm shrink-0">
                      {iniciales}
                    </div>
                    <div>
                      <p className="text-white font-bold text-base leading-tight">{perfil.nombre_completo}</p>
                      <p className="text-gray-500 text-[10px] font-mono">#{detalleCliente.numero_cliente}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetalleCliente(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 shrink-0"
                  >
                    <i className="fa-solid fa-xmark text-sm" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mt-3">
                  {(['perfil', 'pagos'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTabDetalle(t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                        tabDetalle === t
                          ? t === 'perfil' ? 'bg-red-600 text-white' : 'bg-gray-700 text-white'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {t === 'perfil' ? <><i className="fa-solid fa-user mr-1.5" />Perfil</> : <><i className="fa-solid fa-calendar-days mr-1.5" />Hoja de pagos</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── TAB PERFIL ── */}
              {tabDetalle === 'perfil' && (
                <div className="flex-1 overflow-y-auto">
                  {/* Datos de contacto */}
                  <div className="px-5 pt-4 pb-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3">Datos de contacto</p>
                    <div className="space-y-2">
                      {perfil.telefono && (
                        <a
                          href={`tel:${perfil.telefono}`}
                          className="flex items-center gap-3 bg-gray-800/60 rounded-2xl px-4 py-3 active:bg-gray-800 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-phone text-emerald-400 text-sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase">Teléfono</p>
                            <p className="text-white font-semibold text-sm">{perfil.telefono}</p>
                          </div>
                          <i className="fa-solid fa-chevron-right text-gray-600 text-xs" />
                        </a>
                      )}

                      {perfil.email && (
                        <a
                          href={`mailto:${perfil.email}`}
                          className="flex items-center gap-3 bg-gray-800/60 rounded-2xl px-4 py-3 active:bg-gray-800 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-blue-900/30 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-envelope text-blue-400 text-sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase">Correo</p>
                            <p className="text-white font-semibold text-sm truncate">{perfil.email}</p>
                          </div>
                          <i className="fa-solid fa-chevron-right text-gray-600 text-xs" />
                        </a>
                      )}

                      {detalleCliente.direccion && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(detalleCliente.direccion)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 bg-gray-800/60 rounded-2xl px-4 py-3 active:bg-gray-800 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-red-900/30 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-location-dot text-red-400 text-sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase">Dirección</p>
                            <p className="text-white font-semibold text-sm leading-snug">{detalleCliente.direccion}</p>
                          </div>
                          <i className="fa-solid fa-chevron-right text-gray-600 text-xs" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Datos del crédito */}
                  <div className="px-5 pt-4 pb-6">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3">Crédito activo</p>
                    <div className="bg-gray-800/60 rounded-2xl p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase">Cuota</p>
                          <p className="text-base font-black text-red-500">${Math.round(credito.monto_diario).toLocaleString('es-MX')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase">Capital</p>
                          <p className="text-base font-black text-white">${(credito.monto_total || 0).toLocaleString('es-MX')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase">Pagos</p>
                          <p className="text-base font-black text-white">{total}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-700">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                          <span>{pagados} de {total} pagos</span>
                          <span className="font-bold text-emerald-400">{porcentaje}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                        {atrasados > 0 && (
                          <p className="text-red-400 text-[10px] font-bold mt-1.5">
                            <i className="fa-solid fa-triangle-exclamation mr-1" />{atrasados} pago{atrasados !== 1 ? 's' : ''} atrasado{atrasados !== 1 ? 's' : ''}
                          </p>
                        )}
                        {parciales > 0 && (
                          <p className="text-amber-400 text-[10px] font-bold mt-0.5">
                            <i className="fa-solid fa-coins mr-1" />{parciales} con abono parcial
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB PAGOS ── */}
              {tabDetalle === 'pagos' && (
                <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
                  {cronograma.map((item) => (
                    <div
                      key={item.numero}
                      className={`flex items-center gap-3 px-5 py-2.5 ${
                        item.pagado   ? 'bg-emerald-950/20' :
                        item.parcial  ? 'bg-amber-950/20' :
                        item.atrasado ? 'bg-red-950/20' :
                        item.esHoy    ? 'bg-blue-950/20' : ''
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
                        item.pagado   ? 'border-emerald-700 bg-emerald-900/30 text-emerald-400' :
                        item.parcial  ? 'border-amber-700 bg-amber-900/30 text-amber-400' :
                        item.atrasado ? 'border-red-700 bg-red-900/30 text-red-400' :
                        item.esHoy    ? 'border-blue-700 bg-blue-900/30 text-blue-400' :
                                        'border-gray-700 bg-gray-800 text-gray-500'
                      }`}>
                        {item.pagado  ? <i className="fa-solid fa-check text-[10px]" /> :
                         item.parcial ? <i className="fa-solid fa-coins text-[10px]" /> :
                         item.atrasado ? '!' : item.numero}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-xs font-semibold ${
                            item.pagado   ? 'text-emerald-400' :
                            item.parcial  ? 'text-amber-400' :
                            item.atrasado ? 'text-red-400' :
                            item.esHoy    ? 'text-blue-400' : 'text-gray-300'
                          }`}>Pago {item.numero}</p>
                          {item.esHoy    && <span className="text-[9px] font-bold bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded-full">HOY</span>}
                          {item.parcial  && <span className="text-[9px] font-bold bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded-full">ABONO PARCIAL</span>}
                          {item.atrasado && !item.parcial && <span className="text-[9px] font-bold bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded-full">ATRASADO</span>}
                          {item.mora > 0 && <span className="text-[9px] font-bold bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded-full">+${item.mora} mora</span>}
                        </div>
                        <p className={`text-[10px] ${item.atrasado && !item.parcial ? 'text-red-500' : 'text-gray-500'}`}>{item.fecha}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {item.parcial ? (
                          <>
                            <p className="text-sm font-bold text-amber-400">${item.montoPagado.toLocaleString('es-MX')}</p>
                            <p className="text-[10px] text-gray-500">de ${Math.round(credito.monto_diario).toLocaleString('es-MX')}</p>
                          </>
                        ) : (
                          <p className={`text-sm font-bold ${
                            item.pagado   ? 'text-emerald-400' :
                            item.atrasado ? 'text-red-400' :
                            item.esHoy    ? 'text-blue-400' : 'text-gray-400'
                          }`}>${Math.round(credito.monto_diario).toLocaleString('es-MX')}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </BottomSheet>
        );
      })()}

    </main>
  );
}
