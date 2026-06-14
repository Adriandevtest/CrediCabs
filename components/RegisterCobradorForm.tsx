'use client';

import { useState } from 'react';

export default function RegisterCobradorForm({ onCobradorAdded }: { onCobradorAdded?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          nombre: formData.nombre,
          telefono: '',
          rol: 'cobrador'
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error al registrar cobrador');

      alert('¡Cobrador añadido exitosamente al equipo!');
      setFormData({ nombre: '', email: '', password: '' });

      if (onCobradorAdded) onCobradorAdded();

    } catch (error: any) {
      alert('Error al registrar cobrador: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-8 bg-gray-900 rounded-xl shadow-2xl border border-yellow-600 flex flex-col gap-4 w-full">
      <div className="flex items-center gap-3 mb-2 border-l-4 border-yellow-500 pl-3">
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          Alta de <span className="text-yellow-500">Personal</span>
        </h2>
      </div>
      <p className="text-gray-400 text-sm mb-2">Registra a un nuevo cobrador en el sistema.</p>
      
      <div className="flex flex-col gap-1">
        <label className="text-gray-400 text-sm font-medium">Nombre Completo</label>
        <input 
          type="text" 
          placeholder="Ej. Carlos Mendoza" 
          className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none w-full"
          value={formData.nombre}
          onChange={(e) => setFormData({...formData, nombre: e.target.value})}
          required 
        />
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex flex-col w-full md:w-1/2 gap-1">
          <label className="text-gray-400 text-sm font-medium">Correo de Acceso</label>
          <input 
            type="email" 
            placeholder="cobrador@credicabs.com" 
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-yellow-500 outline-none w-full"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required 
          />
        </div>
        <div className="flex flex-col w-full md:w-1/2 gap-1">
          <label className="text-gray-400 text-sm font-medium">Contraseña Temporal</label>
          <input 
            type="text" 
            placeholder="Asigna una contraseña" 
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-yellow-500 outline-none w-full"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
            minLength={6}
          />
        </div>
      </div>

      <button disabled={loading} className="w-full bg-yellow-600 hover:bg-yellow-500 transition-colors p-4 rounded-lg text-black font-black mt-4 shadow-lg shadow-yellow-900/30">
        {loading ? 'Registrando...' : 'Añadir Cobrador'}
      </button>
    </form>
  );
}