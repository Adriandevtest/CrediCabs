'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AsesorForm({ userId }: { userId?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '', telefono: '', direccion: '', ocupacion: '', ingresos: '', monto_solicitado: ''
  });
  const [files, setFiles] = useState<{ine: File | null, comprobante: File | null}>({
    ine: null, comprobante: null
  });

  // Utilidad estricta para formatear a Pesos Mexicanos (MXN)
  const formatMXN = (valor: string) => {
    const num = Number(valor);
    if (isNaN(num) || valor === '') return '$0.00';
    return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  };

  const uploadFile = async (file: File, folder: string) => {
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('expedientes')
      .upload(`${folder}/${fileName}`, file);
    if (error) throw error;
    return supabase.storage.from('expedientes').getPublicUrl(data.path).data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!files.ine || !files.comprobante) throw new Error("Debes subir ambas fotografías");
      if (Number(formData.monto_solicitado) <= 0) throw new Error("El monto solicitado debe ser mayor a cero.");

      // 1. Subir Imágenes
      const ineUrl = await uploadFile(files.ine, 'ines');
      const compUrl = await uploadFile(files.comprobante, 'comprobantes');

      // 2. Guardar Solicitud con el nuevo monto
      const { error } = await supabase.from('solicitudes').insert([{
        nombre_prospecto: formData.nombre,
        telefono: formData.telefono,
        direccion: formData.direccion,
        ocupacion: formData.ocupacion,
        ingreso_mensual: Number(formData.ingresos),
        monto_solicitado: Number(formData.monto_solicitado),
        ine_url: ineUrl,
        comprobante_url: compUrl,
        estado: 'pendiente',
        ...(userId ? { asesor_id: userId } : {}),
      }]);

      if (error) throw error;

      // Notify admin
      supabase.from('notificaciones').insert({
        destinatario_rol: 'admin',
        titulo: 'Nueva solicitud recibida',
        mensaje: `${formData.nombre} — $${Number(formData.monto_solicitado).toLocaleString('es-MX')}`,
        tipo: 'solicitud',
      }).then(() => {});

      alert("✅ Solicitud enviada al administrador con éxito.");
      setFormData({ nombre: '', telefono: '', direccion: '', ocupacion: '', ingresos: '', monto_solicitado: '' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 p-6 rounded-2xl border border-red-900 flex flex-col gap-5 shadow-2xl">
      <h2 className="text-2xl font-bold text-white border-l-4 border-yellow-500 pl-3 mb-2">Nuevo Prospecto</h2>
      
      {/* Datos Personales */}
      <div className="flex flex-col gap-1">
        <label className="text-gray-400 text-xs font-bold uppercase tracking-wider">Nombre Completo</label>
        <input type="text" placeholder="Ej. Juan Pérez" className="bg-gray-800 p-3 rounded-lg text-white border border-gray-700 outline-none focus:border-red-500 transition-colors" 
          value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} required />
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex flex-col gap-1 w-full md:w-1/2">
          <label className="text-gray-400 text-xs font-bold uppercase tracking-wider">Teléfono Celular</label>
          <input type="tel" placeholder="10 dígitos" className="bg-gray-800 p-3 rounded-lg text-white border border-gray-700 focus:border-red-500 outline-none transition-colors" 
            value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} required />
        </div>
        <div className="flex flex-col gap-1 w-full md:w-1/2">
          <label className="text-gray-400 text-xs font-bold uppercase tracking-wider">Ocupación / Oficio</label>
          <input type="text" placeholder="Ej. Comerciante" className="bg-gray-800 p-3 rounded-lg text-white border border-gray-700 focus:border-red-500 outline-none transition-colors" 
            value={formData.ocupacion} onChange={e => setFormData({...formData, ocupacion: e.target.value})} required />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-gray-400 text-xs font-bold uppercase tracking-wider">Domicilio Completo</label>
        <textarea placeholder="Calle, Número, Colonia, Código Postal" className="bg-gray-800 p-3 rounded-lg text-white border border-gray-700 h-20 focus:border-red-500 outline-none transition-colors resize-none" 
          value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} required />
      </div>

      {/* SECCIÓN FINANCIERA (Con protección visual de MXN) */}
      <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl flex flex-col gap-4">
        <h3 className="text-yellow-500 font-bold text-sm uppercase flex items-center gap-2">
          <i className="fa-solid fa-money-bills"></i> Datos Financieros
        </h3>
        
        <div className="flex flex-col md:flex-row gap-4">
          {/* Ingreso Mensual */}
          <div className="flex flex-col gap-1 w-full md:w-1/2">
            <label className="text-gray-400 text-xs font-bold uppercase tracking-wider">Ingreso Mensual (Aprox)</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">$</span>
              <input type="number" placeholder="0.00" className="w-full bg-gray-800 p-3 pl-8 rounded-lg text-white border border-gray-700 focus:border-yellow-500 outline-none transition-colors" 
                value={formData.ingresos} onChange={e => setFormData({...formData, ingresos: e.target.value})} required />
            </div>
            <span className="text-xs text-green-400 font-mono font-bold text-right tracking-widest mt-1">
              {formatMXN(formData.ingresos)}
            </span>
          </div>

          {/* Monto Solicitado */}
          <div className="flex flex-col gap-1 w-full md:w-1/2">
            <label className="text-gray-400 text-xs font-bold uppercase tracking-wider">Monto a Pedir</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">$</span>
              <input type="number" placeholder="0.00" className="w-full bg-gray-800 p-3 pl-8 rounded-lg text-white border border-gray-700 focus:border-yellow-500 outline-none transition-colors" 
                value={formData.monto_solicitado} onChange={e => setFormData({...formData, monto_solicitado: e.target.value})} required />
            </div>
            <span className="text-xs text-yellow-500 font-mono font-bold text-right tracking-widest mt-1">
              {formatMXN(formData.monto_solicitado)}
            </span>
          </div>
        </div>
      </div>

      {/* Fotografías */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div className="flex flex-col gap-2 p-4 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
          <label className="text-white text-sm font-bold flex items-center gap-2">
            <i className="fa-solid fa-id-card text-red-500"></i> Foto INE (Frente)
          </label>
          <input type="file" accept="image/*" className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-700 file:transition-colors cursor-pointer" 
            onChange={e => setFiles({...files, ine: e.target.files![0]})} required />
        </div>
        <div className="flex flex-col gap-2 p-4 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
          <label className="text-white text-sm font-bold flex items-center gap-2">
            <i className="fa-solid fa-file-invoice text-yellow-500"></i> Comprobante Domicilio
          </label>
          <input type="file" accept="image/*" className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-yellow-600 file:text-black hover:file:bg-yellow-500 file:transition-colors cursor-pointer" 
            onChange={e => setFiles({...files, comprobante: e.target.files![0]})} required />
        </div>
      </div>

      <button disabled={loading} className="mt-4 w-full bg-red-600 p-4 rounded-xl text-white font-black hover:bg-red-700 transition-colors shadow-lg shadow-red-900/40 uppercase tracking-widest flex justify-center items-center gap-2">
        {loading ? (
          <span className="animate-pulse">Subiendo Expediente...</span>
        ) : (
          <>Enviar para Revisión <i className="fa-solid fa-paper-plane"></i></>
        )}
      </button>
    </form>
  );
}