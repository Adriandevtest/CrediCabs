'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const MORA_DIA = 50;

type Orden = 'reciente' | 'monto' | 'progreso' | 'mora';

export default function CreditosActivos({ searchQuery }: { searchQuery: string }) {
  const [creditos, setCreditos] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState<Orden>('reciente');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'atrasado'>('todos');

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
          pagos_diarios(id, pagado, fecha_esperada, mora, monto_pagado),
          clientes(numero_cliente, cobrador_asignado_id, profiles(nombre_completo))
        `)
        .in('estado', ['activo', 'atrasado'])
        .order('fecha_inicio', { ascending: false });

      if (!creds) return;

      // Obtener nombres de cobradores
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

  // Resumen global
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

              {/* Montos */}
              <div className="grid grid-cols-3 gap-2 text-center">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
