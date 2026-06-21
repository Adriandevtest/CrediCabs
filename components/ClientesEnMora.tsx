'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { diasDeMora, MORA_POR_DIA } from '../lib/mora';

interface ClienteMora {
  id: string;
  numero_cliente: number;
  cobrador_nombre: string;
  nombre: string;
  telefono: string;
  monto_diario: number;
  credito_id: string;
  dias: number;
  mora: number;
  pagos_diarios: { fecha_esperada: string; pagado: boolean }[];
}

export default function ClientesEnMora({ searchQuery }: { searchQuery: string }) {
  const [clientes, setClientes] = useState<ClienteMora[]>([]);
  const [loading, setLoading] = useState(true);
  const [cobradorFiltro, setCobradorFiltro] = useState('');
  const [cobradores, setCobradores] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    cargar();
    // Refresca automáticamente cada 2 minutos por si el cobrador registra pagos
    const interval = setInterval(cargar, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          id,
          numero_cliente,
          cobrador_asignado_id,
          profiles ( nombre_completo, telefono ),
          creditos (
            id,
            monto_diario,
            estado,
            pagos_diarios ( fecha_esperada, pagado )
          )
        `);

      if (error) throw error;

      // Buscar cobradores para el filtro
      const { data: cobData } = await supabase
        .from('profiles')
        .select('id, nombre_completo')
        .eq('rol', 'cobrador');

      const cobMap = new Map((cobData || []).map((c: any) => [c.id, c.nombre_completo]));
      setCobradores((cobData || []).map((c: any) => ({ id: c.id, nombre: c.nombre_completo })));

      const resultado: ClienteMora[] = [];

      for (const cliente of data || []) {
        const creditos: any[] = (cliente as any).creditos || [];
        // Excluir solo estados terminales; null/activo/atrasado son válidos
        const creditoActivo = creditos.find((c: any) =>
          c.estado !== 'liquidado' && c.estado !== 'completado'
        );
        if (!creditoActivo) continue;

        const pagos: { fecha_esperada: string; pagado: boolean }[] =
          creditoActivo.pagos_diarios || [];

        const dias = diasDeMora(pagos);
        if (dias === 0) continue; // sin mora, no lo incluimos

        resultado.push({
          id: cliente.id,
          numero_cliente: cliente.numero_cliente,
          nombre: (cliente as any).profiles?.nombre_completo || 'Sin nombre',
          telefono: (cliente as any).profiles?.telefono || '',
          cobrador_nombre: cobMap.get((cliente as any).cobrador_asignado_id) || 'Sin asignar',
          monto_diario: creditoActivo.monto_diario,
          credito_id: creditoActivo.id,
          dias,
          mora: dias * MORA_POR_DIA,
          pagos_diarios: pagos,
        });
      }

      // Ordenar por más días de atraso primero
      resultado.sort((a, b) => b.dias - a.dias);
      setClientes(resultado);
    } catch (e) {
      console.error('Error cargando clientes en mora:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = clientes.filter((c) => {
    const matchSearch = !searchQuery ||
      c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(c.numero_cliente).includes(searchQuery);
    const matchCobrador = !cobradorFiltro || c.cobrador_nombre === cobradorFiltro;
    return matchSearch && matchCobrador;
  });

  // Total real a cobrar = (días × cuota) + (días × $50 mora)
  const totalACobrar = filtrados.reduce(
    (a, c) => a + Math.round(c.dias * c.monto_diario) + c.mora, 0
  );
  const totalMoraPenalidad = filtrados.reduce((a, c) => a + c.mora, 0);
  const maxDias = filtrados.length > 0 ? filtrados[0].dias : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Calculando mora...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Refresh manual */}
      <div className="flex justify-end">
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors disabled:opacity-40"
        >
          <i className={`fa-solid fa-rotate-right text-[10px] ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-950/40 border border-red-800/40 rounded-2xl p-4 text-center">
          <p className="text-red-400 font-black text-2xl">{filtrados.length}</p>
          <p className="text-gray-500 text-xs mt-1">Clientes en mora</p>
        </div>
        <div className="bg-red-950/40 border border-red-800/40 rounded-2xl p-4 text-center">
          <p className="text-red-400 font-black text-xl">${totalACobrar.toLocaleString('es-MX')}</p>
          <p className="text-gray-500 text-xs mt-1">Total a cobrar</p>
          <p className="text-red-700 text-[10px] mt-0.5">incl. ${totalMoraPenalidad.toLocaleString('es-MX')} mora</p>
        </div>
        <div className="bg-red-950/40 border border-red-800/40 rounded-2xl p-4 text-center">
          <p className="text-red-400 font-black text-2xl">{maxDias}</p>
          <p className="text-gray-500 text-xs mt-1">Días máx. atraso</p>
        </div>
      </div>

      {/* Filtro por cobrador */}
      {cobradores.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCobradorFiltro('')}
            className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${
              !cobradorFiltro
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Todos
          </button>
          {cobradores.map((c) => (
            <button
              key={c.id}
              onClick={() => setCobradorFiltro(cobradorFiltro === c.nombre ? '' : c.nombre)}
              className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${
                cobradorFiltro === c.nombre
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <i className="fa-solid fa-circle-check text-emerald-500 text-4xl mb-3 block" />
          <p className="text-white font-bold">Sin clientes en mora</p>
          <p className="text-gray-500 text-sm mt-1">
            {searchQuery ? 'No hay resultados para tu búsqueda.' : 'Todos los créditos activos están al corriente.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((c) => {
            const gravedad = c.dias >= 10 ? 'crítico' : c.dias >= 5 ? 'alto' : 'medio';
            const colores = {
              crítico: { borde: 'border-red-600/60',   bg: 'bg-red-950/50',  badge: 'bg-red-600 text-white',         icon: 'text-red-500' },
              alto:    { borde: 'border-orange-600/50', bg: 'bg-orange-950/30', badge: 'bg-orange-500 text-white',    icon: 'text-orange-400' },
              medio:   { borde: 'border-yellow-600/40', bg: 'bg-yellow-950/20', badge: 'bg-yellow-500 text-gray-950', icon: 'text-yellow-400' },
            }[gravedad];

            return (
              <div
                key={c.id}
                className={`bg-gray-900 border ${colores.borde} rounded-2xl p-5 flex flex-col gap-4`}
              >
                {/* Cabecera */}
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm leading-tight truncate">{c.nombre}</p>
                    <p className="text-gray-500 text-xs mt-0.5">Cliente #{c.numero_cliente}</p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full ml-2 shrink-0 ${colores.badge}`}>
                    {c.dias} día{c.dias !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Desglose de deuda */}
                <div className={`${colores.bg} border ${colores.borde} rounded-xl px-4 py-3`}>
                  {/* Cuotas atrasadas */}
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-gray-400 text-[10px] uppercase font-bold">
                      Cuotas atrasadas ({c.dias} × ${Math.round(c.monto_diario).toLocaleString('es-MX')})
                    </p>
                    <p className="text-gray-300 text-sm font-bold">
                      ${Math.round(c.dias * c.monto_diario).toLocaleString('es-MX')}
                    </p>
                  </div>
                  {/* Penalidad mora */}
                  <div className="flex justify-between items-center mb-1.5">
                    <p className={`text-[10px] uppercase font-bold ${colores.icon}`}>
                      Mora ({c.dias} × ${MORA_POR_DIA})
                    </p>
                    <p className={`text-sm font-bold ${colores.icon}`}>
                      +${c.mora.toLocaleString('es-MX')}
                    </p>
                  </div>
                  {/* Total */}
                  <div className="pt-1.5 border-t border-white/5 flex justify-between items-center">
                    <p className="text-gray-400 text-[10px] uppercase font-bold">Total a cobrar</p>
                    <p className="text-white font-black text-lg">
                      ${(Math.round(c.dias * c.monto_diario) + c.mora).toLocaleString('es-MX')}
                    </p>
                  </div>
                </div>

                {/* Cobrador + contacto */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-user text-gray-500 text-[9px]" />
                    </div>
                    <p className="text-gray-400 text-xs truncate">{c.cobrador_nombre}</p>
                  </div>
                  {c.telefono && (
                    <a
                      href={`tel:${c.telefono}`}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors shrink-0"
                    >
                      <i className="fa-solid fa-phone text-[10px]" />
                      {c.telefono}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
