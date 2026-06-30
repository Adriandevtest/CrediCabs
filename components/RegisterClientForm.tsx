'use client';

import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import AdminPinModal from './AdminPinModal';

interface Cobrador {
  id: string;
  nombre_completo: string;
}

type TipoEsquema = 'diario' | 'semanal' | 'quincenal';

export default function RegisterClientForm({ cobradores, onSuccess }: { cobradores: Cobrador[], onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    monto: 5000,
    tipo_esquema: 'diario' as TipoEsquema,
    semanas: 28,
    num_quincenas: 4,
    tasa_interes: 0,
    cobrador_id: '',
  });

  const numPagos = formData.tipo_esquema === 'quincenal' ? formData.num_quincenas : formData.semanas;

  const handleTipoChange = (tipo: TipoEsquema) => {
    const defaultSemanas = tipo === 'diario' ? 28 : tipo === 'semanal' ? 6 : formData.num_quincenas;
    setFormData({ ...formData, tipo_esquema: tipo, semanas: defaultSemanas });
  };

  const handleClickAutorizar = () => {
    if (!formRef.current?.reportValidity()) return;
    if (formData.tipo_esquema === 'quincenal' && formData.num_quincenas < 1) {
      alert('Ingresa un número de quincenas válido.');
      return;
    }
    setPinOpen(true);
  };

  const ejecutarCreacion = async () => {
    setLoading(true);
    try {
      if (!formData.cobrador_id) throw new Error('Por favor selecciona un cobrador');

      const res = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: formData.nombre,
          email: formData.email,
          telefono: formData.telefono,
          direccion: formData.direccion,
          monto_total: formData.monto,
          tipo_esquema: formData.tipo_esquema,
          semanas_autorizadas: numPagos,
          tasa_interes_porcentaje: formData.tasa_interes,
          cobrador_asignado_id: formData.cobrador_id,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al crear cliente');
      }

      alert('¡Cliente y Crédito registrados con éxito!');
      onSuccess?.();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const interes = formData.monto * (formData.tasa_interes / 100);
  const cuota = numPagos > 0 ? Math.ceil((formData.monto + interes) / numPagos) : 0;
  const labelCuota =
    formData.tipo_esquema === 'diario' ? `Pago diario (${numPagos} días)` :
    formData.tipo_esquema === 'semanal' ? `Pago semanal (${numPagos} semanas)` :
    `Pago quincenal (${numPagos} quincenas)`;

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="p-4 md:p-6 bg-gray-950 flex flex-col gap-4 w-full">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 border-l-4 border-yellow-500 pl-3">
        Nuevo Cliente
      </h2>

      <input
        type="text"
        placeholder="Nombre completo"
        className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
        value={formData.nombre}
        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
        required
      />

      <input
        type="email"
        placeholder="Correo electrónico (opcional)"
        className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />

      <input
        type="tel"
        placeholder="Teléfono"
        className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
        value={formData.telefono}
        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
        required
      />

      <input
        type="text"
        placeholder="Dirección"
        className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
        value={formData.direccion}
        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
        required
      />

      {/* Monto */}
      <div className="flex flex-col">
        <label className="text-gray-400 text-sm mb-1 font-medium">Monto del Préstamo ($)</label>
        <input
          type="number"
          className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
          value={formData.monto}
          onChange={(e) => setFormData({ ...formData, monto: Number(e.target.value) })}
          required
        />
      </div>

      {/* Tipo de Esquema */}
      <div className="flex flex-col">
        <label className="text-gray-400 text-sm mb-1 font-medium">Tipo de Esquema</label>
        <div className="grid grid-cols-3 gap-2">
          {(['diario', 'semanal', 'quincenal'] as TipoEsquema[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => handleTipoChange(tipo)}
              className={`py-2.5 rounded-lg text-sm font-bold capitalize transition-colors border ${
                formData.tipo_esquema === tipo
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Número de pagos según tipo */}
      {formData.tipo_esquema === 'diario' && (
        <div className="flex flex-col">
          <label className="text-gray-400 text-sm mb-1 font-medium">Número de Pagos</label>
          <select
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
            value={formData.semanas}
            onChange={(e) => setFormData({ ...formData, semanas: Number(e.target.value) })}
          >
            <option value={28}>28 pagos diarios (~6 semanas)</option>
            <option value={37}>37 pagos diarios (~8 semanas)</option>
          </select>
        </div>
      )}

      {formData.tipo_esquema === 'semanal' && (
        <div className="flex flex-col">
          <label className="text-gray-400 text-sm mb-1 font-medium">Número de Pagos</label>
          <select
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
            value={formData.semanas}
            onChange={(e) => setFormData({ ...formData, semanas: Number(e.target.value) })}
          >
            <option value={6}>6 pagos semanales</option>
            <option value={7}>7 pagos semanales</option>
          </select>
        </div>
      )}

      {formData.tipo_esquema === 'quincenal' && (
        <div className="flex flex-col">
          <label className="text-gray-400 text-sm mb-1 font-medium">Número de Quincenas</label>
          <input
            type="number"
            min="1"
            max="24"
            placeholder="Ej: 4, 6, 12..."
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
            value={formData.num_quincenas}
            onChange={(e) => setFormData({ ...formData, num_quincenas: Number(e.target.value) })}
            required
          />
        </div>
      )}

      {/* Tasa de interés */}
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
          onChange={(e) => setFormData({ ...formData, tasa_interes: Number(e.target.value) })}
        />
      </div>

      {/* Cobrador */}
      <div className="flex flex-col">
        <label className="text-gray-400 text-sm mb-1 font-medium">Asignar Cobrador</label>
        <select
          className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-red-500 outline-none w-full"
          value={formData.cobrador_id}
          onChange={(e) => setFormData({ ...formData, cobrador_id: e.target.value })}
          required
        >
          <option value="" disabled>Selecciona un cobrador...</option>
          {cobradores.map((cobrador) => (
            <option key={cobrador.id} value={cobrador.id}>
              {cobrador.nombre_completo}
            </option>
          ))}
        </select>
      </div>

      {/* Desglose */}
      {formData.monto > 0 && numPagos > 0 && (
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
            <span className="text-gray-400">{labelCuota}</span>
            <span className="text-yellow-400 font-black text-base">${cuota.toLocaleString('es-MX')}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleClickAutorizar}
        className="w-full bg-red-600 hover:bg-red-700 transition-colors p-4 rounded-lg text-white font-bold mt-4 shadow-lg shadow-red-900/50"
      >
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
