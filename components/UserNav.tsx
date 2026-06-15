'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

// Asegúrate de que estos componentes existan en tu carpeta components/ui
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Settings, LogOut } from 'lucide-react';
import { NotifBell } from './NotifBell';

export default function UserNav() {
  const [profile, setProfile] = useState<any>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const router = useRouter();

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile({ ...data, email: user.email });
        setNuevoNombre(data.nombre_completo || '');
        setPreviewUrl(data.avatar_url || '');
      }
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getIniciales = (nombre: string) => {
    if (!nombre) return 'AD';
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2 
      ? (partes[0][0] + partes[1][0]).toUpperCase() 
      : partes[0].substring(0, 2).toUpperCase();
  };

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('userId', profile.id);
      formData.append('nombre', nuevoNombre);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await fetch('/api/admin/update-profile', {
        method: 'POST',
        body: formData,
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error al actualizar el perfil.');

      // Update local state immediately — no need to wait for a refetch
      const newAvatar = resData.avatar_url || previewUrl;
      setProfile((prev: any) => ({ ...prev, nombre_completo: nuevoNombre, avatar_url: newAvatar }));
      setPreviewUrl(newAvatar);
      setAvatarFile(null);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    } catch (e: any) {
      alert('Error al actualizar: ' + e.message);
    } finally {
      setSubiendo(false);
    }
  };

  if (!profile) return <div className="h-10 w-10 rounded-full bg-gray-800 animate-pulse" />;

  return (
    <div className="flex items-center gap-2">
      {profile.rol === 'admin' && (
        <NotifBell filterRol="admin" storageKey="notif_seen_admin" />
      )}
      {profile.rol === 'asesor' && (
        <NotifBell filterId={profile.id} storageKey={`notif_seen_${profile.id}`} />
      )}
    <Dialog>
      <Popover>
        <PopoverTrigger asChild>
          <button className="h-10 w-10 rounded-full border-2 border-gray-700 hover:border-yellow-500 transition-all overflow-hidden focus:outline-none">
            <Avatar className="h-full w-full">
              <AvatarImage src={profile.avatar_url} className="object-cover" />
              <AvatarFallback className="bg-gray-900 text-yellow-500 font-bold text-sm">
                {getIniciales(profile.nombre_completo)}
              </AvatarFallback>
            </Avatar>
          </button>
        </PopoverTrigger>
        
        <PopoverContent className="w-64 p-2 bg-gray-950 border border-gray-800 shadow-xl" align="end">
          <div className="px-3 py-2 border-b border-gray-800 mb-1">
            <p className="text-sm font-bold text-white truncate">{profile.nombre_completo}</p>
            <p className="text-[10px] text-gray-400 truncate">{profile.email}</p>
          </div>

          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full justify-start text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-900">
              <Settings className="mr-2 h-4 w-4" /> Configuración
            </Button>
          </DialogTrigger>

          <Button 
            onClick={handleLogout}
            variant="ghost" 
            className="w-full justify-start text-red-500 hover:text-red-400 hover:bg-red-950/30 text-xs font-bold mt-1"
          >
            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
          </Button>
        </PopoverContent>
      </Popover>

      <DialogContent className="bg-gray-950 border border-gray-800 text-white max-w-sm rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>Configuración de Perfil</DialogTitle>
          <DialogDescription className="sr-only">Panel para editar tus datos personales.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleGuardarConfig} className="space-y-4">
          <div className="flex flex-col items-center gap-2 mb-4">
            <label htmlFor="user-avatar-upload" className="relative cursor-pointer group">
              <Avatar className="h-20 w-20 border-2 border-dashed border-gray-700 bg-gray-900 transition-all group-hover:border-yellow-500">
                <AvatarImage src={previewUrl || ""} className="object-cover" />
                <AvatarFallback className="bg-transparent text-yellow-500 font-bold">
                  {getIniciales(nuevoNombre)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 border border-gray-700 group-hover:bg-yellow-500 text-white text-[10px]">
                +
              </div>
            </label>
            <input 
              id="user-avatar-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  setAvatarFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                }
              }} 
            />
            <p className="text-[10px] text-gray-500">Haz clic para cambiar foto</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Nombre Completo</Label>
            <Input 
              value={nuevoNombre} 
              onChange={(e) => setNuevoNombre(e.target.value)} 
              className="bg-gray-900 border-gray-800 text-white"
            />
          </div>
          {guardadoOk && (
            <p className="text-emerald-400 text-xs text-center font-semibold">✓ Perfil actualizado correctamente</p>
          )}
          <Button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold" disabled={subiendo}>
            {subiendo ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </div>
  );
}