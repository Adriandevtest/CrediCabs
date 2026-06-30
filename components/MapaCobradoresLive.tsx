'use client';
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';

type Ubicacion = {
  user_id: string;
  lat: number;
  lng: number;
  precision_metros: number | null;
  updated_at: string;
  profiles: { nombre_completo: string; rol: string; avatar_url?: string; foto_url?: string } | null;
};

function crearIconoFoto(u: Ubicacion, color: string, online: boolean, seleccionado: boolean): L.DivIcon {
  const foto = u.profiles?.avatar_url || u.profiles?.foto_url || '';
  const nombre = u.profiles?.nombre_completo || 'U';
  const inicial = nombre[0].toUpperCase();
  const size = seleccionado ? 48 : 38;
  const border = seleccionado ? '#facc15' : (online ? color : '#6b7280');
  const bw = seleccionado ? 3 : 2;
  const dotColor = online ? '#34d399' : '#6b7280';

  const inner = foto
    ? `<img src="${foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
    : `<div style="width:100%;height:100%;border-radius:50%;background:${color}22;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${Math.round(size * 0.38)}px;color:${color};font-family:system-ui;">${inicial}</div>`;

  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:${bw}px solid ${border};box-shadow:0 2px 10px rgba(0,0,0,0.6);">
        ${inner}
      </div>
      <span style="position:absolute;bottom:0;right:0;width:10px;height:10px;background:${dotColor};border-radius:50%;border:2px solid #111827;"></span>
    </div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 4],
  });
}

function AjustarVista({ ubicaciones }: { ubicaciones: Ubicacion[] }) {
  const map = useMap();
  useEffect(() => {
    if (ubicaciones.length === 0) return;
    if (ubicaciones.length === 1) {
      map.setView([ubicaciones[0].lat, ubicaciones[0].lng], 15);
      return;
    }
    const lats = ubicaciones.map(u => u.lat);
    const lngs = ubicaciones.map(u => u.lng);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [50, 50] }
    );
  }, [ubicaciones.length]);
  return null;
}

function tiempoTranscurrido(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'ahora mismo';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

const COLORES: Record<string, string> = {
  cobrador: '#ef4444',
  supervisor: '#3b82f6',
};

const LIMITE_EN_LINEA = 10 * 60 * 1000; // 10 minutos

export default function MapaCobradoresLive({ fullscreen = false }: { fullscreen?: boolean }) {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargarUbicaciones = async () => {
    const { data } = await supabase
      .from('ubicaciones')
      .select('user_id, lat, lng, precision_metros, updated_at, profiles(nombre_completo, rol, avatar_url, foto_url)')
      .order('updated_at', { ascending: false });
    if (data) setUbicaciones(data as unknown as Ubicacion[]);
    setCargando(false);
  };

  useEffect(() => {
    cargarUbicaciones();

    const channel = supabase
      .channel('ubicaciones-mapa-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ubicaciones' }, () => {
        cargarUbicaciones();
      })
      .subscribe();

    // Refresca el "hace X min" cada 30s sin hacer fetch
    timerRef.current = setInterval(() => setUbicaciones(p => [...p]), 30000);

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const ahora = Date.now();
  const enLinea = (iso: string) => ahora - new Date(iso).getTime() < LIMITE_EN_LINEA;
  const totalEnLinea = ubicaciones.filter(u => enLinea(u.updated_at)).length;

  const alturaMapaFullscreen = 'calc(100vh - 200px)';
  const alturaMapaNormal = '380px';

  if (cargando) {
    return (
      <div
        className="bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center"
        style={{ height: fullscreen ? alturaMapaFullscreen : '400px' }}
      >
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${fullscreen ? 'flex-1' : ''}`}>

      {/* Header — solo en modo dashboard (no fullscreen) */}
      {!fullscreen && (
        <div className="px-4 md:px-6 py-3 bg-gray-950 border border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h2 className="text-white font-bold text-base">Ubicación en Tiempo Real</h2>
            <p className="text-gray-500 text-xs">Cobradores y supervisores activos</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Cobrador
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Supervisor
            </span>
            <button onClick={cargarUbicaciones} className="text-gray-500 hover:text-yellow-400 transition-colors ml-1" title="Recargar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Stats bar — solo fullscreen */}
      {fullscreen && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">En línea</p>
            <p className="text-emerald-400 font-black text-2xl">{totalEnLinea}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">Total activos</p>
            <p className="text-white font-black text-2xl">{ubicaciones.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">Offline</p>
            <p className="text-red-400 font-black text-2xl">{ubicaciones.length - totalEnLinea}</p>
          </div>
        </div>
      )}

      {/* Layout principal: mapa + lista */}
      <div className={`flex flex-col md:flex-row gap-4 ${fullscreen ? 'flex-1' : ''}`}>

        {/* Mapa */}
        <div
          className="flex-1 rounded-2xl overflow-hidden border border-gray-800"
          style={{ height: fullscreen ? alturaMapaFullscreen : alturaMapaNormal }}
        >
          {ubicaciones.length === 0 ? (
            <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-3 text-center px-6">
              <p className="text-4xl">📍</p>
              <p className="text-gray-400 font-medium">Sin ubicaciones activas</p>
              <p className="text-gray-600 text-sm">Los cobradores y supervisores aparecerán aquí cuando estén en ruta</p>
            </div>
          ) : (
            <MapContainer
              center={[19.4326, -99.1332]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              zoomControl
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              />
              <AjustarVista ubicaciones={ubicaciones} />
              {ubicaciones.map((u) => {
                const rol = u.profiles?.rol || 'cobrador';
                const color = COLORES[rol] || '#ef4444';
                const online = enLinea(u.updated_at);
                const esSeleccionado = seleccionado === u.user_id;
                const foto = u.profiles?.avatar_url || u.profiles?.foto_url || '';
                return (
                  <Marker
                    key={u.user_id}
                    position={[u.lat, u.lng]}
                    icon={crearIconoFoto(u, color, online, esSeleccionado)}
                    eventHandlers={{ click: () => setSeleccionado(u.user_id === seleccionado ? null : u.user_id) }}
                  >
                    <Popup>
                      <div style={{ minWidth: 180, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          {foto ? (
                            <img src={foto} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}` }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: color + '22', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color }}>
                              {(u.profiles?.nombre_completo || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p style={{ fontWeight: 800, fontSize: 14, margin: 0, lineHeight: 1.2 }}>
                              {u.profiles?.nombre_completo || 'Usuario'}
                            </p>
                            <p style={{ color: '#9ca3af', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                              {rol}
                            </p>
                          </div>
                        </div>
                        <p style={{ fontSize: 12, margin: '0 0 3px' }}>
                          <span style={{ color: online ? '#34d399' : '#f87171', fontWeight: 700 }}>
                            {online ? '● En línea' : '○ Offline'}
                          </span>
                          {' · '}{tiempoTranscurrido(u.updated_at)}
                        </p>
                        {u.precision_metros && (
                          <p style={{ color: '#9ca3af', fontSize: 11, margin: 0 }}>
                            Precisión: ±{Math.round(u.precision_metros)} m
                          </p>
                        )}
                        <p style={{ color: '#6b7280', fontSize: 10, margin: '4px 0 0' }}>
                          {u.lat.toFixed(5)}, {u.lng.toFixed(5)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* Lista lateral — solo en fullscreen */}
        {fullscreen && (
          <div className="md:w-72 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
              <p className="text-white font-bold text-sm">Equipo en Ruta</p>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Cobrador</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Supervisor</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60">
              {ubicaciones.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">Sin registros</p>
              ) : (
                ubicaciones.map((u) => {
                  const online = enLinea(u.updated_at);
                  const rol = u.profiles?.rol || 'cobrador';
                  const color = COLORES[rol] || '#ef4444';
                  const esSeleccionado = seleccionado === u.user_id;
                  return (
                    <button
                      key={u.user_id}
                      onClick={() => setSeleccionado(u.user_id === seleccionado ? null : u.user_id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-gray-800/60 ${esSeleccionado ? 'bg-gray-800' : ''}`}
                    >
                      {/* Avatar con foto o inicial */}
                      <div className="relative shrink-0">
                        <div
                          className="w-9 h-9 rounded-full overflow-hidden border-2"
                          style={{ borderColor: online ? color : '#374151' }}
                        >
                          {(u.profiles?.avatar_url || u.profiles?.foto_url) ? (
                            <img
                              src={u.profiles?.avatar_url || u.profiles?.foto_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center font-black text-sm"
                              style={{ backgroundColor: online ? color + '22' : '#1f2937', color: online ? color : '#6b7280' }}
                            >
                              {(u.profiles?.nombre_completo || 'U')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span
                          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900"
                          style={{ background: online ? '#34d399' : '#6b7280' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate leading-tight">
                          {u.profiles?.nombre_completo || 'Usuario'}
                        </p>
                        <p className="text-gray-500 text-[10px] capitalize">{rol}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${online ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}
                        >
                          {online ? '● vivo' : '○ off'}
                        </span>
                        <p className="text-gray-600 text-[9px] mt-0.5">{tiempoTranscurrido(u.updated_at)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t border-gray-800 px-4 py-2.5 flex justify-between items-center">
              <span className="text-gray-500 text-[10px]">Actualiza automáticamente</span>
              <button onClick={cargarUbicaciones} className="text-gray-500 hover:text-yellow-400 transition-colors" title="Recargar">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista compacta — solo en modo dashboard (no fullscreen) */}
      {!fullscreen && ubicaciones.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800/60 overflow-hidden">
          {ubicaciones.map((u) => {
            const online = enLinea(u.updated_at);
            const rol = u.profiles?.rol || 'cobrador';
            return (
              <div key={u.user_id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${online ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: online ? (COLORES[rol] || '#ef4444') : '#6b7280' }}
                  />
                  <div>
                    <p className="text-white text-sm font-medium leading-tight">{u.profiles?.nombre_completo || 'Usuario'}</p>
                    <p className="text-gray-500 text-[10px] capitalize">{rol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-medium ${online ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {online ? 'En línea' : 'Offline'}
                  </p>
                  <p className="text-gray-600 text-[10px]">{tiempoTranscurrido(u.updated_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
