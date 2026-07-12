import useSWR from 'swr';
import { supabase } from '../supabase';

export interface Cobrador {
  id: string;
  nombre_completo: string;
}

const fetchCobradores = async (): Promise<Cobrador[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre_completo')
    .eq('rol', 'cobrador')
    .order('nombre_completo', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Roster de cobradores compartido entre dashboard, clientes, bandeja y mora.
 * Cambia rara vez (solo al contratar/despedir), así que se cachea con una
 * ventana larga en vez de refetch por componente.
 */
export function useCobradores() {
  const { data, error, isLoading, mutate } = useSWR('cobradores', fetchCobradores, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  return {
    cobradores: data || [],
    loading: isLoading,
    error,
    mutate,
  };
}
