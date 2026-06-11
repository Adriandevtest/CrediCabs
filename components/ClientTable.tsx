'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ClientTable() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(`numero_cliente, profiles ( nombre_completo ), creditos ( monto_total, monto_diario, estado )`)
        .order('numero_cliente', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-yellow-500 font-bold p-8 text-center w-full">Cargando datos...</div>;

  return (
    <div className="bg-gray-900 rounded-xl shadow-2xl border border-red-900 overflow-hidden w-full">
      <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
        <h2 className="text-xl md:text-2xl font-bold text-white">Cartera Activa</h2>
        <button onClick={fetchClientes} className="text-yellow-500 hover:text-yellow-400 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>
      
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-red-950 text-white text-xs md:text-sm uppercase tracking-wider">
              <th className="p-4 font-medium border-b border-red-900">No. Cliente</th>
              <th className="p-4 font-medium border-b border-red-900">Nombre</th>
              <th className="p-4 font-medium border-b border-red-900">Crédito Total</th>
              <th className="p-4 font-medium border-b border-red-900">Diario</th>
              <th className="p-4 font-medium border-b border-red-900">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {clientes.map((cliente, index) => {
              const credito = cliente.creditos && cliente.creditos.length > 0 ? cliente.creditos[0] : null;
              return (
                <tr key={index} className="hover:bg-gray-800/80 transition-colors">
                  <td className="p-4 text-yellow-500 font-bold">{cliente.numero_cliente}</td>
                  <td className="p-4 text-white font-medium">{cliente.profiles?.nombre_completo || 'Sin nombre'}</td>
                  <td className="p-4 text-gray-300">{credito ? `$${credito.monto_total.toLocaleString('es-MX')}` : '---'}</td>
                  <td className="p-4 text-white font-bold">{credito ? `$${Math.round(credito.monto_diario).toLocaleString('es-MX')}` : '---'}</td>
                  <td className="p-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
                      {credito?.estado || 'activo'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}