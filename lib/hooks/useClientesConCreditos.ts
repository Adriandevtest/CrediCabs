import { useEffect } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export interface PagoDiario {
  id: string;
  pagado: boolean;
  fecha_esperada: string;
  numero_dia: number;
  mora: number;
  monto_pagado: number;
}

export interface CreditoConPagos {
  id: string;
  monto_total: number;
  monto_diario: number;
  estado: string;
  semanas_autorizadas: number;
  tasa_interes_porcentaje: number;
  fecha_inicio: string;
  pagos_diarios: PagoDiario[];
}

export interface ClienteConCreditos {
  id: string;
  numero_cliente: number;
  direccion: string | null;
  cobrador_asignado_id: string | null;
  profiles: {
    nombre_completo: string;
    telefono: string | null;
    foto_url: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
  creditos: CreditoConPagos[];
}

const CLIENTES_KEY = 'clientes-con-creditos';

const fetchClientesConCreditos = async (): Promise<ClienteConCreditos[]> => {
  const { data, error } = await supabase
    .from('clientes')
    .select(`
      id,
      numero_cliente,
      direccion,
      cobrador_asignado_id,
      profiles ( nombre_completo, telefono, foto_url, avatar_url, email ),
      creditos (
        id, monto_total, monto_diario, estado, semanas_autorizadas,
        tasa_interes_porcentaje, fecha_inicio,
        pagos_diarios ( id, pagado, fecha_esperada, numero_dia, mora, monto_pagado )
      )
    `)
    .order('numero_cliente', { ascending: false });

  if (error) throw error;
  return (data as any) || [];
};

// ── Suscripción realtime con conteo de referencias ──────────────────────
// Antes cada componente (ClientTable, dashboard, etc.) abría su propio canal
// de Supabase y volvía a pedir todo desde cero en cada evento. Aquí se abre
// UN solo canal compartido sin importar cuántos componentes usen el hook a
// la vez: el primero en montar lo crea, el último en desmontar lo cierra.
let channelRefCount = 0;
let channel: RealtimeChannel | null = null;

function subscribeRealtime(): () => void {
  channelRefCount++;
  if (channelRefCount === 1) {
    channel = supabase
      .channel('clientes-con-creditos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos_diarios' }, () => {
        globalMutate(CLIENTES_KEY);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creditos' }, () => {
        globalMutate(CLIENTES_KEY);
      })
      .subscribe();
  }
  return () => {
    channelRefCount--;
    if (channelRefCount === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}

/**
 * Dataset compartido entre las 3 pestañas de /clientes (Todos, Cartera
 * activa, Mora) y la tabla de cartera del dashboard. Antes cada una hacía
 * su propia query anidada (clientes+creditos+pagos_diarios) al montar, así
 * que cambiar de pestaña repetía la misma carga pesada. Ahora se pide una
 * sola vez y cada consumidor deriva su vista con useMemo.
 */
export function useClientesConCreditos() {
  const { data, error, isLoading, mutate } = useSWR(CLIENTES_KEY, fetchClientesConCreditos, {
    dedupingInterval: 10_000,
    // Revalidación periódica única y compartida por todos los consumidores
    // (antes ClientesEnMora tenía su propio setInterval de 2 min por cada
    // vez que se montaba esa pestaña; ahora es un solo timer para toda la app).
    refreshInterval: 120_000,
  });

  useEffect(() => subscribeRealtime(), []);

  return {
    clientes: data || [],
    loading: isLoading,
    error,
    mutate,
  };
}

export { CLIENTES_KEY };
