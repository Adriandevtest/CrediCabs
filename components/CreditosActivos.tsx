'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const MORA_DIA = 50;

type Orden = 'reciente' | 'monto' | 'progreso' | 'mora';

function ModalHistorial({ credito, onClose }: { credito: any; onClose: () => void }) {
  const hoy = new Date().toISOString().split('T')[0];
  const cuota = Math.round(credito.monto_diario || 0);

  const pagos = useMemo(() => {
    return [...(credito.pagos_diarios || [])].sort(
      (a: any, b: any) => (a.numero_dia ?? 0) - (b.numero_dia ?? 0)
    );
  }, [credito]);

  const stats = useMemo(() => {
    let pagados = 0, parciales = 0, atrasados = 0, pendientes = 0;
    for (const p of pagos) {
      if (p.pagado) { pagados++; continue; }
      const montoPagado = Number(p.monto_pagado) || 0;
      if (montoPagado > 0) { parciales++; continue; }
      if (p.fecha_esperada < hoy) atrasados++;
      else pendientes++;
    }
    return { pagados, parciales, atrasados, pendientes };
  }, [pagos, hoy]);

  const getEstado = (p: any) => {
    if (p.pagado) return 'pagado';
    const montoPagado = Number(p.monto_pagado) || 0;
    if (montoPagado > 0) return 'parcial';
    if (p.fecha_esperada < hoy) return 'atrasado';
    return 'pendiente';
  };

  const chipClases: Record<string, string> = {
    pagado:    'bg-emerald-900/40 text-emerald-400 border-emerald-800/40',
    parcial:   'bg-amber-900/40 text-amber-400 border-amber-800/40',
    atrasado:  'bg-red-900/40 text-red-400 border-red-800/40',
    pendiente: 'bg-gray-800 text-gray-500 border-gray-700',
  };
  const chipLabel: Record<string, string> = {
    pagado: 'Pagado', parcial: 'Parcial', atrasado: 'Atrasado', pendiente: 'Pendiente',
  };

  const formatFecha = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-950 border border-gray-800 w-full max-w-2xl rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-gray-800 flex justify-between items-start">
          <div>
            <h2 className="text-white font-black text-base">{credito._nombre}</h2>
            <p className="text-gray-500 text-[11px] mt-0.5">
              {credito._numero} · <i className="fa-solid fa-user-tie mr-0.5" />{credito._cobrador}
            </p>
            <p className="text-yellow-400 text-[11px] font-bold mt-0.5">
              ${cuota.toLocaleString('es-MX')}/día · {credito.semanas_autorizadas} pagos
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none ml-4">&times;</button>
        </div>

        {/* Stats */}
        <div className="shrink-0 grid grid-cols-4 divide-x divide-gray-800 border-b border-gray-800">
          {[
            { label: 'Pagados',   value: stats.pagados,   color: 'text-emerald-400' },
            { label: 'Parciales', value: stats.parciales, color: 'text-amber-400' },
            { label: 'Atrasados', value: stats.atrasados, color: 'text-red-400' },
            { label: 'Pendientes',value: stats.pendientes,color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="text-center py-3">
              <p className={`font-black text-lg ${s.color}`}>{s.value}</p>
              <p className="text-gray-600 text-[9px] uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabla — desktop */}
        <div className="hidden md:block overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-950 border-b border-gray-800">
              <tr>
                <th className="text-left text-gray-500 font-bold px-4 py-2.5 uppercase text-[10px]">Día</th>
                <th className="text-left text-gray-500 font-bold px-4 py-2.5 uppercase text-[10px]">Fecha</th>
                <th className="text-left text-gray-500 font-bold px-4 py-2.5 uppercase text-[10px]">Estado</th>
                <th className="text-right text-gray-500 font-bold px-4 py-2.5 uppercase text-[10px]">Cuota</th>
                <th className="text-right text-gray-500 font-bold px-4 py-2.5 uppercase text-[10px]">Pagado</th>
                <th className="text-right text-gray-500 font-bold px-4 py-2.5 uppercase text-[10px]">Mora</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p: any, i: number) => {
                const estado = getEstado(p);
                const montoPagado = p.pagado ? cuota : (Number(p.monto_pagado) || 0);
                const rowBg = estado === 'atrasado' ? 'bg-red-950/20' : estado === 'parcial' ? 'bg-amber-950/20' : '';
                return (
                  <tr key={p.id} className={`border-b border-gray-800/50 ${rowBg}`}>
                    <td className="px-4 py-2.5 text-gray-400 font-mono">#{p.numero_dia ?? i + 1}</td>
                    <td className="px-4 py-2.5 text-gray-300">{formatFecha(p.fecha_esperada)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${chipClases[estado]}`}>
                        {chipLabel[estado]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">${cuota.toLocaleString('es-MX')}</td>
                    <td className="px-4 py-2.5 text-right font-bold">
                      {montoPagado > 0 ? (
                        <span className={estado === 'pagado' ? 'text-emerald-400' : 'text-amber-400'}>
                          ${montoPagado.toLocaleString('es-MX')}
                        </span>
                      ) : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.mora > 0
                        ? <span className="text-red-400 font-bold">+${p.mora.toLocaleString('es-MX')}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Lista — móvil */}
        <div className="md:hidden overflow-y-auto flex-1 min-h-0 divide-y divide-gray-800/50">
          {pagos.map((p: any, i: number) => {
            const estado = getEstado(p);
            const montoPagado = p.pagado ? cuota : (Number(p.monto_pagado) || 0);
            const rowBg = estado === 'atrasado' ? 'bg-red-950/20' : estado === 'parcial' ? 'bg-amber-950/20' : '';
            return (
              <div key={p.id} className={`flex items-center justify-between px-4 py-3 ${rowBg}`}>
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 font-mono text-[10px] w-8 shrink-0">#{p.numero_dia ?? i + 1}</span>
                  <div>
                    <p className="text-gray-300 text-xs">{formatFecha(p.fecha_esperada)}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${chipClases[estado]}`}>
                      {chipLabel[estado]}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-[10px]">cuota ${cuota.toLocaleString('es-MX')}</p>
                  {montoPagado > 0 ? (
                    <p className={`text-xs font-bold ${estado === 'pagado' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      pagó ${montoPagado.toLocaleString('es-MX')}
                    </p>
                  ) : null}
                  {p.mora > 0 && (
                    <p className="text-red-400 text-[10px] font-bold">+${p.mora.toLocaleString('es-MX')} mora</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CreditosActivos({ searchQuery }: { searchQuery: string }) {
  const [creditos, setCreditos] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState<Orden>('reciente');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'atrasado'>('todos');
  const [historialCredito, setHistorialCredito] = useState<any | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const { data: creds } = await supabase
        .from('creditos')
        .select(`
          id, monto_total, monto_diario, semanas_autorizadas,
          tasa_interes_porcentaje, estado, fecha_inicio,
          pagos_diarios(id, pagado, fecha_esperada, numero_dia, mora, monto_pagado),
          clientes(numero_cliente, cobrador_asignado_id, profiles(nombre_completo))
        `)
        .in('estado', ['activo', 'atrasado'])
        .order('fecha_inicio', { ascending: false });

      if (!creds) return;

      const cobradorIds = [...new Set(
        creds.map((c: any) => c.clientes?.cobrador_asignado_id).filter(Boolean)
      )] as string[];

      let profileMap: Record<string, string> = {};
      if (cobradorIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, nombre_completo')
          .in('id', cobradorIds);
        (profs || []).forEach((p: any) => { profileMap[p.id] = p.nombre_completo; });
      }

      setCreditos(creds);
      setProfiles(profileMap);
    } finally {
      setLoading(false);
    }
  };

  const hoy = new Date().toISOString().split('T')[0];

  const enriquecidos = useMemo(() => creditos.map((c: any) => {
    const pagos: any[] = c.pagos_diarios || [];
    const cuota = Math.round(c.monto_diario || 0);
    const pagados = pagos.filter((p: any) => p.pagado).length;
    const total = pagos.length;
    const progreso = total > 0 ? Math.round((pagados / total) * 100) : 0;
    const atrasados = pagos.filter((p: any) => !p.pagado && p.fecha_esperada < hoy).length;
    const mora = atrasados * MORA_DIA;
    const abonoParcial = pagos
      .filter((p: any) => !p.pagado && (Number(p.monto_pagado) || 0) > 0)
      .reduce((s: number, p: any) => s + (Number(p.monto_pagado) || 0), 0);
    const totalAbonado = pagados * cuota + abonoParcial;
    const saldo = Math.max(0, total * cuota - totalAbonado);
    const nombre = c.clientes?.profiles?.nombre_completo || '—';
    const numero = c.clientes?.numero_cliente || '—';
    const cobrador = profiles[c.clientes?.cobrador_asignado_id] || '—';
    return { ...c, _pagados: pagados, _total: total, _progreso: progreso, _mora: mora, _abonoParcial: abonoParcial, _totalAbonado: totalAbonado, _saldo: saldo, _nombre: nombre, _numero: numero, _cobrador: cobrador };
  }), [creditos, profiles, hoy]);

  const filtrados = useMemo(() => {
    let list = enriquecidos;
    if (filtroEstado !== 'todos') list = list.filter((c: any) => c.estado === filtroEstado);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: any) =>
        c._nombre.toLowerCase().includes(q) ||
        c._numero.toLowerCase().includes(q) ||
        c._cobrador.toLowerCase().includes(q)
      );
    }
    switch (orden) {
      case 'monto':    return [...list].sort((a, b) => b.monto_total - a.monto_total);
      case 'progreso': return [...list].sort((a, b) => b._progreso - a._progreso);
      case 'mora':     return [...list].sort((a, b) => b._mora - a._mora);
      default:         return list;
    }
  }, [enriquecidos, filtroEstado, searchQuery, orden]);

  const totalCapital   = enriquecidos.reduce((s, c) => s + c.monto_total, 0);
  const totalSaldo     = enriquecidos.reduce((s, c) => s + c._saldo, 0);
  const totalCobrado   = enriquecidos.reduce((s, c) => s + c._totalAbonado, 0);
  const totalMora      = enriquecidos.reduce((s, c) => s + c._mora, 0);
  const enAtrasoCnt    = enriquecidos.filter((c) => c._mora > 0).length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4 pb-6">

      {/* ── Tarjetas de resumen ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Créditos activos', value: enriquecidos.length, sub: `${enAtrasoCnt} con atraso`, color: 'text-white', bg: 'bg-gray-900' },
          { label: 'Capital en calle', value: `$${totalSaldo.toLocaleString('es-MX')}`, sub: `de $${totalCapital.toLocaleString('es-MX')} otorgado`, color: 'text-yellow-400', bg: 'bg-gray-900' },
          { label: 'Total cobrado', value: `$${totalCobrado.toLocaleString('es-MX')}`, sub: 'pagos confirmados', color: 'text-emerald-400', bg: 'bg-gray-900' },
          { label: 'Mora pendiente', value: `$${totalMora.toLocaleString('es-MX')}`, sub: `${enAtrasoCnt} cliente${enAtrasoCnt !== 1 ? 's' : ''}`, color: totalMora > 0 ? 'text-red-400' : 'text-gray-500', bg: 'bg-gray-900' },
        ].map((t) => (
          <div key={t.label} className={`${t.bg} border border-gray-800 rounded-2xl p-4`}>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{t.label}</p>
            <p className={`font-black text-xl ${t.color}`}>{t.value}</p>
            <p className="text-gray-600 text-[10px] mt-0.5">{t.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {(['todos', 'activo', 'atrasado'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltroEstado(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                filtroEstado === f
                  ? f === 'atrasado' ? 'bg-red-600 text-white' : 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'activo' ? 'Al día' : 'Atrasados'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-auto">
          <span className="text-gray-600 text-xs self-center">Ordenar:</span>
          {([['reciente', 'Reciente'], ['monto', 'Monto'], ['progreso', 'Progreso'], ['mora', 'Mora']] as [Orden, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setOrden(key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${orden === key ? 'bg-yellow-500 text-gray-950' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista de créditos ── */}
      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <p className="text-gray-500 text-sm">Sin créditos que coincidan</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((c: any) => (
            <div key={c.id} className={`bg-gray-900 border rounded-2xl p-4 transition-colors ${c._mora > 0 ? 'border-red-900/60' : 'border-gray-800'}`}>
              {/* Fila principal */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-black text-sm truncate">{c._nombre}</p>
                    <span className="text-[9px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full shrink-0">{c._numero}</span>
                    {c._mora > 0 && (
                      <span className="text-[9px] text-red-400 bg-red-900/30 border border-red-800/40 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                        ATRASADO +${c._mora.toLocaleString('es-MX')} mora
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-[10px] mt-0.5">
                    <i className="fa-solid fa-user-tie mr-1" />{c._cobrador}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-yellow-400 font-black text-lg">${Math.round(c.monto_diario).toLocaleString('es-MX')}<span className="text-gray-500 text-[10px] font-normal">/día</span></p>
                  <p className="text-gray-400 text-[10px]">{c.tasa_interes_porcentaje}% · {c.semanas_autorizadas} pagos</p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500">{c._pagados} de {c._total} pagos</span>
                  <span className={`font-bold ${c._progreso >= 75 ? 'text-emerald-400' : c._progreso >= 40 ? 'text-yellow-400' : 'text-gray-400'}`}>{c._progreso}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${c._mora > 0 ? 'bg-red-500' : c._progreso >= 75 ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                    style={{ width: `${c._progreso}%` }}
                  />
                </div>
              </div>

              {/* Montos + botón historial */}
              <div className="flex items-end gap-2">
                <div className="grid grid-cols-3 gap-2 text-center flex-1">
                  <div>
                    <p className="text-gray-500 text-[9px] uppercase">Capital</p>
                    <p className="text-white text-xs font-bold">${c.monto_total.toLocaleString('es-MX')}</p>
                  </div>
                  <div>
                    <p className="text-emerald-500 text-[9px] uppercase">Abonado</p>
                    <p className="text-emerald-400 text-xs font-bold">${c._totalAbonado.toLocaleString('es-MX')}</p>
                    {c._abonoParcial > 0 && (
                      <p className="text-amber-400 text-[9px] mt-0.5">+${c._abonoParcial.toLocaleString('es-MX')} parcial</p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-500 text-[9px] uppercase">Saldo</p>
                    <p className="text-white text-xs font-bold">${c._saldo.toLocaleString('es-MX')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setHistorialCredito(c)}
                  className="shrink-0 text-[10px] font-bold text-gray-400 hover:text-yellow-400 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <i className="fa-solid fa-clock-rotate-left text-[9px]" />
                  Historial
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal historial de pagos */}
      {historialCredito && (
        <ModalHistorial
          credito={historialCredito}
          onClose={() => setHistorialCredito(null)}
        />
      )}
    </div>
  );
}
