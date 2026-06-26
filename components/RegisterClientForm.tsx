'use client';

import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import AdminPinModal from './AdminPinModal';

interface Cobrador {
  id: string;
  nombre_completo: string;
}

export default function RegisterClientForm({ cobradores, onSuccess }: { cobradores: Cobrador[], onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    password: 'C' + Math.random().toString(36).slice(-6),
    monto: 5000,
    semanas: 28,
    tasa_interes: 0,
    cobrador_id: '',
    fecha_inicio: new Date().toISOString().split('T')[0]
  });

  // type="button" + reportValidity() = validación HTML5 sin pasar por form submit,
  // lo que mantiene el gesto de usuario intacto para que el teclado abra en móvil
  const handleClickAutorizar = () => {
    if (!formRef.current?.reportValidity()) return;
    setPinOpen(true);
  };

  const ejecutarCreacion = async () => {
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
          telefono: formData.telefono,
          direccion: formData.direccion,
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
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="p-6 md:p-8 bg-gray-900 rounded-xl shadow-2xl border border-red-900 flex flex-col gap-4 w-full">
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
        placeholder="Correo electrónico (opcional)"
        className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
      />

      <input
        type="tel"
        placeholder="Teléfono"
        className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
        value={formData.telefono}
        onChange={(e) => setFormData({...formData, telefono: e.target.value})}
        required
      />

      <input
        type="text"
        placeholder="Dirección"
        className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
        value={formData.direccion}
        onChange={(e) => setFormData({...formData, direccion: e.target.value})}
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
          <label className="text-gray-400 text-sm mb-1 font-medium">Esquema de Pago</label>
          <select
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
            value={formData.semanas}
            onChange={(e) => setFormData({...formData, semanas: Number(e.target.value)})}
            required
          >
            <option value={28}>28 pagos diarios (~6 semanas)</option>
            <option value={37}>37 pagos diarios (~8 semanas)</option>
          </select>
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

      {formData.monto > 0 && formData.semanas > 0 && (() => {
        const interes = formData.monto * (formData.tasa_interes / 100);
        const pagodiario = Math.ceil((formData.monto + interes) / formData.semanas);
        return (
          <div className="bg-gray-950 p-3 rounded-lg border border-gray-700 text-sm space-y-1">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Desglose del crédito</p>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Capital</span>
              <span className="text-white font-semibold">${formData.monto.toLocaleString('es-MX')}</span>
            </div>
            <div className="flex justify-between items-center text-yellow-500/80">
              <span>+ Interés ({formData.tasa_interes}%)</span>
              <span className="font-semibold">${interes.toLocaleString('es-MX')}</span>
            </div>
            <div className="border-t border-gray-700 pt-1 flex justify-between items-center">
              <span className="text-gray-300 font-bold">Total a pagar</span>
              <span className="text-white font-black">${(formData.monto + interes).toLocaleString('es-MX')}</span>
            </div>
            <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-700">
              <span className="text-gray-400">Pago diario ({formData.semanas} días)</span>
              <span className="text-yellow-400 font-black text-base">${pagodiario.toLocaleString('es-MX')}</span>
            </div>
          </div>
        );
      })()}

      <button type="button" disabled={loading} onClick={handleClickAutorizar} className="w-full bg-red-600 hover:bg-red-700 transition-colors p-4 rounded-lg text-white font-bold mt-4 shadow-lg shadow-red-900/50">
        {loading ? 'Procesando...' : (
          <span className="flex items-center justify-center gap-2">
            <i className="fa-solid fa-shield-halved" />
            Autorizar Crédito
          </span>
        )}
      </button>

      <AdminPinModal
        open={pinOpen}
        titulo="Autorizar Crédito"
        descripcion="Ingresa el PIN de administrador para autorizar este crédito."
        onConfirm={() => { setPinOpen(false); ejecutarCreacion(); }}
        onCancel={() => setPinOpen(false)}
      />
    </form>
  );
}