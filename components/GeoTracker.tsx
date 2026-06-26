'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const GPS_CONSENT_KEY = 'credicabs-gps-consent';

type Estado = 'inactivo' | 'activo' | 'error' | 'sin_soporte';

interface Props {
  userId: string;
  onStatusChange?: (estado: Estado) => void;
}

export default function GeoTracker({ userId, onStatusChange }: Props) {
  const [estado, setEstado] = useState<Estado>('inactivo');
  const [consentDado, setConsentDado] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(GPS_CONSENT_KEY) === 'true'
  );

  const actualizar = (e: Estado) => {
    setEstado(e);
    onStatusChange?.(e);
  };

  const aceptarConsentimiento = () => {
    localStorage.setItem(GPS_CONSENT_KEY, 'true');
    setConsentDado(true);
  };

  useEffect(() => {
    if (!userId || !consentDado) return;
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
  }, [userId, consentDado]);

  if (!consentDado) {
    return (
      <div className="fixed inset-x-0 bottom-20 z-50 px-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 max-w-md mx-auto">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">📍</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Rastreo de ubicación</p>
              <p className="text-xs text-gray-500 mt-0.5">
                CrediCabs registra tu ubicación GPS durante tu jornada para que el administrador pueda ver tu ruta en tiempo real.
              </p>
              <button
                onClick={aceptarConsentimiento}
                className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-xl transition-colors"
              >
                Entendido, activar GPS
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
