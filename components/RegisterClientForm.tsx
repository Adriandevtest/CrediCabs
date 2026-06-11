'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Cobrador {
  id: string;
  nombre_completo: string;
}

export default function RegisterClientForm({ cobradores, onSuccess }: { cobradores: Cobrador[], onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: 'C' + Math.random().toString(36).slice(-6),
    monto: 5000,
    semanas: 4,
    tasa_interes: 0,
    cobrador_id: '',
    fecha_inicio: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.cobrador_id) {
        throw new Error('Por favor selecciona un cobrador');
      }

      // Usar API endpoint para crear cliente (mantiene sesión del admin)
      const res = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: formData.nombre,
          email: formData.email,
          monto_total: formData.monto,
          semanas_autorizadas: formData.semanas,
          tasa_interes_porcentaje: formData.tasa_interes,
          cobrador_asignado_id: formData.cobrador_id
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al crear cliente');
      }

      const result = await res.json();

      alert('¡Cliente y Crédito registrados con éxito!');
      onSuccess?.();

    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-8 bg-gray-900 rounded-xl shadow-2xl border border-red-900 flex flex-col gap-4 w-full">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 border-l-4 border-yellow-500 pl-3">
        Nuevo Cliente
      </h2>
      
      <input 
        type="text" 
        placeholder="Nombre completo" 
        className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
        value={formData.nombre}
        onChange={(e) => setFormData({...formData, nombre: e.target.value})}
        required 
      />

      <input 
        type="email" 
        placeholder="Correo electrónico" 
        className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        required 
      />

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex flex-col w-full md:w-1/2">
          <label className="text-gray-400 text-sm mb-1 font-medium">Monto del Préstamo ($)</label>
          <input
            type="number"
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
            value={formData.monto}
            onChange={(e) => setFormData({...formData, monto: Number(e.target.value)})}
            required
          />
        </div>
        <div className="flex flex-col w-full md:w-1/2">
          <label className="text-gray-400 text-sm mb-1 font-medium">Semanas a Pagar</label>
          <input
            type="number"
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
            value={formData.semanas}
            onChange={(e) => setFormData({...formData, semanas: Number(e.target.value)})}
            required
          />
        </div>
      </div>

      <div className="flex flex-col">
        <label className="text-gray-400 text-sm mb-1 font-medium">Tasa de Interés (%)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          placeholder="ej: 2.5, 3, 5"
          className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
          value={formData.tasa_interes}
          onChange={(e) => setFormData({...formData, tasa_interes: Number(e.target.value)})}
        />
      </div>

      <div className="flex flex-col">
        <label className="text-gray-400 text-sm mb-1 font-medium">Asignar Cobrador</label>
        <select 
          className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
          value={formData.cobrador_id}
          onChange={(e) => setFormData({...formData, cobrador_id: e.target.value})}
          required
        >
          <option value="" disabled>Selecciona un cobrador...</option>
          {cobradores.map(cobrador => (
            <option key={cobrador.id} value={cobrador.id}>
              {cobrador.nombre_completo}
            </option>
          ))}
        </select>
      </div>

      <button disabled={loading} className="w-full bg-red-600 hover:bg-red-700 transition-colors p-4 rounded-lg text-white font-bold mt-4 shadow-lg shadow-red-900/50">
        {loading ? 'Procesando...' : 'Autorizar Crédito'}
      </button>
    </form>
  );
}