'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ClientTable from '../components/ClientTable';
import ActionModal from '../components/ActionModal';
import ExcelImportExport from '../components/ExcelImportExport';
import AdminPinModal from '../components/AdminPinModal';
import { supabase } from '../lib/supabase';
import UserNav from '../components/UserNav';
import { LumaSpin } from '../components/luma-spin';

export default function Home() {
  const [cobradores, setCobradores] = useState<any[]>([]);
  const [metricas, setMetricas] = useState({
    capital: 0,
    clientes: 0,
    cobroHoy: 0,
    capitalActual: 0,
  });
  const [corteCaja, setCorteCaja] = useState<any[]>([]);
  const [totalCobradoHoy, setTotalCobradoHoy] = useState(0);
  const [totalMoraHoy, setTotalMoraHoy] = useState(0);
  const [metaHoy, setMetaHoy] = useState(0);
  const [totalPagosEsperados, setTotalPagosEsperados] = useState(0);
  const [abonosParciales, setAbonosParciales] = useState<any[]>([]);
  const [totalAbonoParcial, setTotalAbonoParcial] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [capitalFlash, setCapitalFlash] = useState(false);
  const [pinPreviewOpen, setPinPreviewOpen] = useState(false);
  const [showRetiro, setShowRetiro] = useState(false);
  const [montoRetiro, setMontoRetiro] = useState('');
  const [showIngreso, setShowIngreso] = useState(false);
  const [montoIngreso, setMontoIngreso] = useState('');
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

    // Broadcast del servidor al aprobar transferencias (más confiable que postgres_changes)
    const chBc = supabase
      .channel('admin-pagos')
      .on('broadcast', { event: 'pago_aprobado' }, () => {
        setCapitalFlash(true);
        setTimeout(() => setCapitalFlash(false), 1500);
        cargarDatosDashboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(chBc); };
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
        else if (profile?.rol === 'supervisor') router.push('/supervisor');
        else if (profile?.rol === 'cliente') router.push('/panel-cliente');
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
        .select('monto_total, monto_diario, interes_total, pagos_diarios(pagado, monto_pagado)')
        .or('estado.eq.activo,estado.is.null,estado.eq.atrasado');

      if (creditosData) {
        // Capital pendiente = suma de pagos sin cobrar × cuota − abonos parciales ya registrados
        const totalCapital = (creditosData as any[]).reduce((s, c) => {
          const pagos = c.pagos_diarios || [];
          const cuota = Number(c.monto_diario || 0);
          const pendientes = pagos.filter((p: any) => !p.pagado).length;
          const abonado = pagos.filter((p: any) => !p.pagado).reduce((a: number, p: any) => a + (Number(p.monto_pagado) || 0), 0);
          return s + Math.max(0, pendientes * cuota - abonado);
        }, 0);

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

        // Capital actual = total cobrado (cuotas + mora) − capital prestado en créditos activos
        const [{ data: pagosRealizados }, { data: creditosActivos }] = await Promise.all([
          supabase
            .from('pagos_diarios')
            .select('mora, creditos!inner(monto_diario)')
            .eq('pagado', true),
          supabase
            .from('creditos')
            .select('monto_total')
            .or('estado.eq.activo,estado.is.null,estado.eq.atrasado'),
        ]);

        const totalCobrado = (pagosRealizados as any[] || []).reduce(
          (s, p) => s + Number(p.creditos?.monto_diario || 0) + Number(p.mora || 0), 0
        );
        const totalPrestado = (creditosActivos as any[] || []).reduce(
          (s, c) => s + Number(c.monto_total || 0), 0
        );
        const capitalActual = totalCobrado - totalPrestado;

        setMetricas({
          capital: totalCapital,
          clientes: creditosData.length,
          cobroHoy: Math.round(meta),
          capitalActual: Math.round(capitalActual),
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

      // 4. Abonos parciales pendientes (pagos no completados con monto > 0)
      const { data: abonosData } = await supabase
        .from('pagos_diarios')
        .select(`
          id, fecha_esperada, monto_pagado, numero_dia,
          creditos (
            monto_diario,
            clientes (
              numero_cliente,
              cobrador_asignado_id,
              profiles ( nombre_completo )
            )
          )
        `)
        .eq('pagado', false)
        .gt('monto_pagado', 0)
        .order('fecha_esperada', { ascending: true });

      if (abonosData) {
        // Obtener nombres de cobradores para abonos
        const cobIdsAbonos = [...new Set(
          (abonosData as any[]).map((p: any) => p.creditos?.clientes?.cobrador_asignado_id).filter(Boolean)
        )] as string[];
        let cobMapAbonos: Record<string, string> = {};
        if (cobIdsAbonos.length) {
          const { data: cobProfs } = await supabase
            .from('profiles').select('id, nombre_completo').in('id', cobIdsAbonos);
          cobMapAbonos = Object.fromEntries((cobProfs || []).map((c: any) => [c.id, c.nombre_completo]));
        }
        const abonosFinal = (abonosData as any[]).map((p: any) => ({
          ...p,
          _cobrador: cobMapAbonos[p.creditos?.clientes?.cobrador_asignado_id] || 'Sin asignar',
        }));
        setAbonosParciales(abonosFinal);
        setTotalAbonoParcial(Math.round(abonosFinal.reduce((s, p) => s + Number(p.monto_pagado || 0), 0)));
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  };

  const generarPDFIngreso = () => {
    const monto = parseFloat(montoIngreso.replace(/[^0-9.]/g, ''));
    if (!monto || monto <= 0) return;

    const fecha = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const folio = `ING-${Date.now().toString().slice(-6)}`;

    const win = window.open('', '_blank', 'width=420,height=600');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Comprobante de Ingreso ${folio}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#111; padding:32px 28px; max-width:400px; margin:0 auto; }
  .header { text-align:center; border-bottom:2px solid #111; padding-bottom:16px; margin-bottom:20px; }
  .brand { font-size:26px; font-weight:900; letter-spacing:-0.5px; }
  .brand span { color:#cc0000; }
  .subtitle { font-size:10px; letter-spacing:4px; text-transform:uppercase; color:#555; margin-top:2px; }
  .badge { display:inline-block; margin-top:10px; background:#111; color:#fff; font-size:11px; font-weight:700; padding:4px 14px; border-radius:20px; letter-spacing:1px; }
  .folio { text-align:center; color:#888; font-size:10px; margin-bottom:20px; letter-spacing:2px; }
  .row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; font-size:13px; }
  .row .label { color:#555; }
  .row .value { font-weight:700; }
  .divider { border:none; border-top:1px dashed #ccc; margin:18px 0; }
  .monto-box { background:#f0f9ff; border:2px solid #3b82f6; border-radius:12px; padding:18px 20px; text-align:center; margin:20px 0; }
  .monto-label { font-size:10px; text-transform:uppercase; letter-spacing:2px; color:#2563eb; font-weight:700; }
  .monto-valor { font-size:36px; font-weight:900; color:#111; margin-top:4px; }
  .saldo { background:#f9f9f9; border:1px solid #e5e5e5; border-radius:10px; padding:14px 18px; margin-top:16px; }
  .saldo-row { display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; }
  .saldo-row:last-child { margin-bottom:0; font-weight:700; font-size:13px; border-top:1px solid #ddd; padding-top:8px; margin-top:4px; }
  .footer { text-align:center; margin-top:28px; font-size:9px; color:#aaa; line-height:1.6; }
  @media print { body { padding:20px; } button { display:none !important; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">Credi <span>Cab's</span></div>
  <div class="subtitle">Servicios Financieros</div>
  <div class="badge">Comprobante de Ingreso</div>
</div>
<div class="folio">Folio: ${folio}</div>
<div class="row"><span class="label">Fecha</span><span class="value">${fecha}</span></div>
<div class="row"><span class="label">Hora</span><span class="value">${hora}</span></div>
<hr class="divider"/>
<div class="monto-box">
  <div class="monto-label">Monto ingresado</div>
  <div class="monto-valor">$${monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
</div>
<div class="saldo">
  <div class="saldo-row"><span>Capital antes del ingreso</span><span>$${metricas.capitalActual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  <div class="saldo-row"><span>Ingreso</span><span style="color:#2563eb">+$${monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  <div class="saldo-row"><span>Saldo resultante</span><span>$${(metricas.capitalActual + monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
</div>
<div class="footer">
  Este documento es un comprobante interno de Credi Cab's.<br/>
  Conserve este recibo para su registro contable.<br/><br/>
  © ${new Date().getFullYear()} Credi Cab's · Todos los derechos reservados
</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`);
    win.document.close();
    setShowIngreso(false);
    setMontoIngreso('');
  };

  const generarPDFRetiro = () => {
    const monto = parseFloat(montoRetiro.replace(/[^0-9.]/g, ''));
    if (!monto || monto <= 0) return;

    const fecha = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const folio = `RET-${Date.now().toString().slice(-6)}`;

    const win = window.open('', '_blank', 'width=420,height=600');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Comprobante de Retiro ${folio}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#111; padding:32px 28px; max-width:400px; margin:0 auto; }
  .header { text-align:center; border-bottom:2px solid #111; padding-bottom:16px; margin-bottom:20px; }
  .brand { font-size:26px; font-weight:900; letter-spacing:-0.5px; }
  .brand span { color:#cc0000; }
  .subtitle { font-size:10px; letter-spacing:4px; text-transform:uppercase; color:#555; margin-top:2px; }
  .badge { display:inline-block; margin-top:10px; background:#111; color:#fff; font-size:11px; font-weight:700; padding:4px 14px; border-radius:20px; letter-spacing:1px; }
  .folio { text-align:center; color:#888; font-size:10px; margin-bottom:20px; letter-spacing:2px; }
  .row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; font-size:13px; }
  .row .label { color:#555; }
  .row .value { font-weight:700; }
  .divider { border:none; border-top:1px dashed #ccc; margin:18px 0; }
  .monto-box { background:#f0faf4; border:2px solid #22c55e; border-radius:12px; padding:18px 20px; text-align:center; margin:20px 0; }
  .monto-label { font-size:10px; text-transform:uppercase; letter-spacing:2px; color:#16a34a; font-weight:700; }
  .monto-valor { font-size:36px; font-weight:900; color:#111; margin-top:4px; }
  .saldo { background:#f9f9f9; border:1px solid #e5e5e5; border-radius:10px; padding:14px 18px; margin-top:16px; }
  .saldo-row { display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; }
  .saldo-row:last-child { margin-bottom:0; font-weight:700; font-size:13px; border-top:1px solid #ddd; padding-top:8px; margin-top:4px; }
  .footer { text-align:center; margin-top:28px; font-size:9px; color:#aaa; line-height:1.6; }
  @media print {
    body { padding:20px; }
    button { display:none !important; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="brand">Credi <span>Cab's</span></div>
  <div class="subtitle">Servicios Financieros</div>
  <div class="badge">Comprobante de Retiro</div>
</div>
<div class="folio">Folio: ${folio}</div>
<div class="row"><span class="label">Fecha</span><span class="value">${fecha}</span></div>
<div class="row"><span class="label">Hora</span><span class="value">${hora}</span></div>
<hr class="divider"/>
<div class="monto-box">
  <div class="monto-label">Monto retirado</div>
  <div class="monto-valor">$${monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
</div>
<div class="saldo">
  <div class="saldo-row"><span>Capital antes del retiro</span><span>$${metricas.capitalActual.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  <div class="saldo-row"><span>Retiro</span><span style="color:#cc0000">-$${monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  <div class="saldo-row"><span>Saldo restante</span><span>$${Math.max(0, metricas.capitalActual - monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
</div>
<div class="footer">
  Este documento es un comprobante interno de Credi Cab's.<br/>
  Conserve este recibo para su registro contable.<br/><br/>
  © ${new Date().getFullYear()} Credi Cab's · Todos los derechos reservados
</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`);
    win.document.close();
    setShowRetiro(false);
    setMontoRetiro('');
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
          {/* Botón preview PIN — solo móvil */}
          <button
            onClick={() => setPinPreviewOpen(true)}
            className="text-gray-500 hover:text-yellow-400 transition-colors p-1"
            title="Probar modal PIN"
          >
            <i className="fa-solid fa-key text-sm" />
          </button>
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
          {/* Botón preview PIN — escritorio */}
          <button
            onClick={() => setPinPreviewOpen(true)}
            className="flex items-center gap-2 text-gray-600 hover:text-yellow-400 text-xs transition-colors py-1 px-2 rounded-lg hover:bg-gray-900"
            title="Probar modal PIN"
          >
            <i className="fa-solid fa-key" />
            Probar PIN
          </button>
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
          <div className={`bg-gray-900 border-l-4 border-emerald-500 p-4 md:p-6 rounded-r-xl transition-colors duration-300 ${capitalFlash ? 'bg-emerald-950/40' : ''}`}>
            <div className="flex items-center gap-1.5">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider">Capital Actual</p>
              {capitalFlash && (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-900/50 px-1.5 py-0.5 rounded-full animate-pulse">
                  ↑ cobro
                </span>
              )}
            </div>
            <p className={`text-xl md:text-3xl font-bold mt-1 transition-colors duration-500 ${capitalFlash ? 'text-emerald-400' : 'text-emerald-400'}`}>
              ${metricas.capitalActual.toLocaleString('es-MX')}
            </p>
            <p className="text-gray-600 text-[10px] mt-1">total cobrado · cuotas + mora</p>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => { setShowIngreso(true); setMontoIngreso(''); }}
                className="flex items-center gap-1 text-[10px] font-bold text-blue-400 border border-blue-800/60 bg-blue-950/30 hover:bg-blue-900/40 active:bg-blue-900/60 px-2.5 py-1 rounded-lg transition-colors"
              >
                <i className="fa-solid fa-arrow-down-to-bracket text-[9px]" />
                Ingreso
              </button>
              <button
                onClick={() => { setShowRetiro(true); setMontoRetiro(''); }}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 border border-emerald-800/60 bg-emerald-950/30 hover:bg-emerald-900/40 active:bg-emerald-900/60 px-2.5 py-1 rounded-lg transition-colors"
              >
                <i className="fa-solid fa-arrow-up-from-bracket text-[9px]" />
                Retiro
              </button>
            </div>
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

        {/* Abonos Parciales Pendientes */}
        {abonosParciales.length > 0 && (
          <div className="bg-gray-900 border border-amber-900/40 rounded-2xl overflow-hidden mb-8">
            <div className="px-4 md:px-6 py-4 border-b border-amber-900/30 bg-gray-950 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <h2 className="text-white font-bold text-lg">Abonos Parciales</h2>
                  <span className="text-[10px] text-amber-400 bg-amber-900/30 border border-amber-800/40 px-2 py-0.5 rounded-full font-bold">
                    {abonosParciales.length} pendiente{abonosParciales.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5">Pagos con abono incompleto — falta cobrar el saldo</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-amber-400 font-black text-lg">${totalAbonoParcial.toLocaleString('es-MX')}</p>
                <p className="text-gray-500 text-[10px]">total abonado</p>
              </div>
            </div>

            {/* Tabla escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                    <th className="px-6 py-3 font-medium">Cliente</th>
                    <th className="px-6 py-3 font-medium">No. Cliente</th>
                    <th className="px-6 py-3 font-medium">Cobrador</th>
                    <th className="px-6 py-3 font-medium text-center">Pago</th>
                    <th className="px-6 py-3 font-medium text-right">Abonado</th>
                    <th className="px-6 py-3 font-medium text-right">Resta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {abonosParciales.map((p, i) => {
                    const cliente = p.creditos?.clientes;
                    const cuota = Number(p.creditos?.monto_diario || 0);
                    const abonado = Number(p.monto_pagado || 0);
                    const resta = Math.max(0, cuota - abonado);
                    return (
                      <tr key={p.id} className={`hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-800/20'}`}>
                        <td className="px-6 py-3 text-white font-medium">{cliente?.profiles?.nombre_completo || '—'}</td>
                        <td className="px-6 py-3 text-yellow-500 font-mono text-xs">{cliente?.numero_cliente || '—'}</td>
                        <td className="px-6 py-3 text-gray-400 text-xs">{p._cobrador}</td>
                        <td className="px-6 py-3 text-center">
                          <span className="text-[11px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                            {p.numero_dia} · {p.fecha_esperada}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right text-amber-400 font-bold">
                          ${abonado.toLocaleString('es-MX')}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-300 font-bold">
                          ${resta.toLocaleString('es-MX')} <span className="text-gray-600 text-[10px] font-normal">de ${Math.round(cuota).toLocaleString('es-MX')}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Lista móvil */}
            <div className="md:hidden divide-y divide-gray-800/60">
              {abonosParciales.map((p) => {
                const cliente = p.creditos?.clientes;
                const cuota = Number(p.creditos?.monto_diario || 0);
                const abonado = Number(p.monto_pagado || 0);
                const resta = Math.max(0, cuota - abonado);
                return (
                  <div key={p.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{cliente?.profiles?.nombre_completo || '—'}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-yellow-500 font-mono text-[10px]">{cliente?.numero_cliente}</span>
                        <span className="text-gray-600 text-[10px]">·</span>
                        <span className="text-gray-500 text-[10px]">Pago {p.numero_dia} · {p.fecha_esperada}</span>
                        <span className="text-gray-600 text-[10px]">·</span>
                        <span className="text-gray-400 text-[10px] truncate">{p._cobrador}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-amber-400 font-bold text-sm">${abonado.toLocaleString('es-MX')} abonado</p>
                      <p className="text-gray-400 text-[10px]">Resta ${resta.toLocaleString('es-MX')} de ${Math.round(cuota).toLocaleString('es-MX')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Exportar / Importar Excel — solo PC */}
        <div className="mb-4">
          <ExcelImportExport
            cobradores={cobradores}
            onImportDone={cargarDatosDashboard}
          />
        </div>

        <ClientTable />

        <ActionModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); cargarDatosDashboard(); }}
          cobradores={cobradores}
        />
      </div>

      {/* ── MODAL INGRESO ── */}
      {showIngreso && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl md:rounded-3xl p-6 space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-arrow-down-to-bracket text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-black text-base leading-tight">Ingreso de capital</p>
                  <p className="text-gray-500 text-[10px]">Capital actual: <span className="text-blue-400 font-bold">${metricas.capitalActual.toLocaleString('es-MX')}</span></p>
                </div>
              </div>
              <button
                onClick={() => setShowIngreso(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium block mb-2">Monto a ingresar</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-black text-lg">$</span>
                <input
                  type="number"
                  value={montoIngreso}
                  onChange={e => setMontoIngreso(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-9 pr-4 py-4 rounded-2xl text-white text-xl font-black placeholder:text-gray-700 bg-gray-800 border border-gray-700 focus:border-blue-500/50 focus:outline-none transition-colors"
                  onKeyDown={e => e.key === 'Enter' && generarPDFIngreso()}
                  autoFocus
                />
              </div>
            </div>

            <button
              onClick={generarPDFIngreso}
              disabled={!montoIngreso || parseFloat(montoIngreso) <= 0}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm tracking-wide bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-pdf" />
              Generar comprobante PDF
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL RETIRO ── */}
      {showRetiro && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl md:rounded-3xl p-6 space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-arrow-up-from-bracket text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-black text-base leading-tight">Retiro de capital</p>
                  <p className="text-gray-500 text-[10px]">Capital disponible: <span className="text-emerald-400 font-bold">${metricas.capitalActual.toLocaleString('es-MX')}</span></p>
                </div>
              </div>
              <button
                onClick={() => setShowRetiro(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium block mb-2">Monto a retirar</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-lg">$</span>
                <input
                  type="number"
                  value={montoRetiro}
                  onChange={e => setMontoRetiro(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-9 pr-4 py-4 rounded-2xl text-white text-xl font-black placeholder:text-gray-700 bg-gray-800 border border-gray-700 focus:border-emerald-500/50 focus:outline-none transition-colors"
                  onKeyDown={e => e.key === 'Enter' && generarPDFRetiro()}
                  autoFocus
                />
              </div>
              {montoRetiro && parseFloat(montoRetiro) > metricas.capitalActual && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <i className="fa-solid fa-triangle-exclamation text-[9px]" />
                  El monto supera el capital disponible
                </p>
              )}
            </div>

            <button
              onClick={generarPDFRetiro}
              disabled={!montoRetiro || parseFloat(montoRetiro) <= 0}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm tracking-wide bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-pdf" />
              Generar comprobante PDF
            </button>
          </div>
        </div>
      )}

      {/* Modal preview PIN — solo para probar la apariencia y el teclado */}
      <AdminPinModal
        open={pinPreviewOpen}
        titulo="Probar modal PIN"
        descripcion="Este es el modal de seguridad. En móvil el teclado debe abrirse automáticamente."
        onConfirm={() => setPinPreviewOpen(false)}
        onCancel={() => setPinPreviewOpen(false)}
      />
    </main>
  );
}
