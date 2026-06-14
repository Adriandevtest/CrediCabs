'use client';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';

type Pos = { lat: number; lng: number; precision_metros: number | null; updated_at: string };

function tiempoTranscurrido(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'ahora mismo';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

export default function MapaUbicacionPropia({ userId }: { userId: string }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    const { data } = await supabase
      .from('ubicaciones')
      .select('lat, lng, precision_metros, updated_at')
      .eq('user_id', userId)
      .single();
    if (data) setPos(data as Pos);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, [userId]);

  if (cargando) {
    return (
      <div className="h-56 flex flex-col items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Buscando tu posición...</p>
      </div>
    );
  }

  if (!pos) {
    return (
      <div className="h-56 flex flex-col items-center justify-center gap-2 text-center px-6">
        <p className="text-3xl">📡</p>
        <p className="text-gray-700 font-medium text-sm">Sin ubicación registrada</p>
        <p className="text-gray-400 text-xs">El GPS se activa automáticamente al usar la app. Espera unos segundos.</p>
        <button onClick={cargar} className="mt-2 text-red-600 text-sm font-medium">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mapa */}
      <div className="h-56 rounded-2xl overflow-hidden border border-gray-100">
        <MapContainer
          center={[pos.lat, pos.lng]}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CircleMarker
            center={[pos.lat, pos.lng]}
            radius={12}
            pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>Tu posición actual</Popup>
          </CircleMarker>
        </MapContainer>
      </div>

      {/* Info */}
      <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gray-800 font-medium text-sm">Última posición</p>
          <p className="text-gray-500 text-xs truncate">
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
            {pos.precision_metros ? ` · ±${Math.round(pos.precision_metros)} m` : ''}
          </p>
          <p className="text-gray-400 text-[10px]">Actualizado {tiempoTranscurrido(pos.updated_at)}</p>
        </div>
        <button onClick={cargar} className="text-gray-400 hover:text-red-500 transition-colors shrink-0" title="Actualizar">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Abrir en Google Maps */}
      <a
        href={`https://maps.google.com/?q=${pos.lat},${pos.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-red-600 active:bg-red-700 text-white py-3 rounded-xl text-sm font-medium text-center flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        Abrir en Google Maps
      </a>
    </div>
  );
}
