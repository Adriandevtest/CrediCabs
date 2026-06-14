'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Estado = 'inactivo' | 'activo' | 'error' | 'sin_soporte';

interface Props {
  userId: string;
  onStatusChange?: (estado: Estado) => void;
}

export default function GeoTracker({ userId, onStatusChange }: Props) {
  const [estado, setEstado] = useState<Estado>('inactivo');

  const actualizar = (e: Estado) => {
    setEstado(e);
    onStatusChange?.(e);
  };

  useEffect(() => {
    if (!userId) return;
    if (!navigator.geolocation) { actualizar('sin_soporte'); return; }

    const enviar = async (lat: number, lng: number, precision: number) => {
      await supabase.from('ubicaciones').upsert(
        { user_id: userId, lat, lng, precision_metros: precision, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        enviar(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        actualizar('activo');
      },
      () => actualizar('error'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId]);

  const colores: Record<Estado, string> = {
    activo: 'bg-blue-500',
    inactivo: 'bg-gray-400',
    error: 'bg-red-400',
    sin_soporte: 'bg-gray-600',
  };

  const titulos: Record<Estado, string> = {
    activo: 'GPS activo — ubicación en vivo',
    inactivo: 'Iniciando GPS...',
    error: 'No se pudo obtener ubicación',
    sin_soporte: 'GPS no disponible en este dispositivo',
  };

  return (
    <span
      title={titulos[estado]}
      className={`w-2 h-2 rounded-full shrink-0 ${colores[estado]} ${estado === 'activo' ? 'animate-pulse' : ''}`}
    />
  );
}
