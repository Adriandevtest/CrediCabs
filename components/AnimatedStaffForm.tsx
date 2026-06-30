'use client';

import * as React from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from '../lib/supabase';

// Componentes UI
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface AnimatedStaffFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  className?: string;
}

export const AnimatedStaffForm: React.FC<AnimatedStaffFormProps> = ({ onSuccess, onCancel, className }) => {
  const [nombre, setNombre] = React.useState("");
  const [telefono, setTelefono] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rol, setRol] = React.useState("cobrador");
  const [loading, setLoading] = React.useState(false);
  
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Crear usuario a través del API para no perder la sesión del Admin
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nombre,
          telefono,
          rol
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Error al crear el usuario en el servidor.');
      }

      const userId = resData.userId;
      let avatarUrl = null;

      // 2. Subir imagen si existe (a través del API para evitar problemas de RLS)
      if (avatarFile) {
        const formData = new FormData();
        formData.append('userId', userId);
        formData.append('nombre', nombre);
        formData.append('avatar', avatarFile);

        const avatarRes = await fetch('/api/admin/update-profile', {
          method: 'POST',
          body: formData,
        });

        const avatarData = await avatarRes.json();
        if (!avatarRes.ok) throw new Error(avatarData.error || 'Error al subir la imagen.');
        
        if (avatarData.avatar_url) {
          setPreviewUrl(avatarData.avatar_url);
        }
      }

      alert('¡Personal registrado con éxito!');
      onSuccess();
    } catch (error: any) {
      console.error("Error crítico:", error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("relative w-full max-w-2xl rounded-2xl bg-gray-950 border border-gray-800 p-6 shadow-2xl", className)}>
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-2 h-6 bg-yellow-500 rounded-full"></span> Alta de Personal
        </h3>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-5 w-5" /></Button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="flex flex-col items-center gap-3 md:col-span-1">
          <label htmlFor="avatar-upload" className="relative mt-2 cursor-pointer group">
            <Avatar className="h-28 w-28 border-2 border-dashed border-gray-700 bg-gray-900 transition-all group-hover:border-yellow-500">
              <AvatarImage src={previewUrl || ""} className="object-cover" />
              <AvatarFallback className="bg-transparent">
                <Plus className="h-8 w-8 text-gray-500" />
              </AvatarFallback>
            </Avatar>
            <div className="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 border border-gray-700 group-hover:bg-yellow-500">
              <Plus className="h-4 w-4" />
            </div>
          </label>
          <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <p className="text-xs text-gray-500 text-center">Foto de perfil</p>
        </div>

        <div className="flex flex-col gap-5 md:col-span-2">
          <div className="grid w-full gap-2">
            <Label>Nombre Completo *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid w-full gap-2">
              <Label>Teléfono *</Label>
              <Input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} required placeholder="993 000 0000" />
            </div>
            <div className="grid w-full gap-2">
              <Label>Correo Acceso *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid w-full gap-2">
              <Label>Contraseña *</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="grid w-full gap-2">
              <Label>Rol *</Label>
              <select className="flex h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" value={rol} onChange={(e) => setRol(e.target.value)}>
                <option value="cobrador">🏍️ Cobrador de Ruta</option>
                <option value="supervisor">💼 Supervisor de Campo</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 md:col-span-3 mt-4 pt-4 border-t border-gray-800">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 font-bold">
            {loading ? 'Registrando...' : 'Añadir al Equipo'}
          </Button>
        </div>
      </form>
    </motion.div>
  );
};