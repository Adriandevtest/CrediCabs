'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AsesorForm from '../../components/AsesorForm';
import UserNav from '../../components/UserNav';
import GeoTracker from '../../components/GeoTracker';
import { LumaSpin } from '../../components/luma-spin';

type Tab = 'nueva' | 'solicitudes' | 'perfil';
type GpsEstado = 'inactivo' | 'activo' | 'error' | 'sin_soporte';

const ESTADO_BADGE: Record<string, { label: string; classes: string }> = {
  pendiente:  { label: 'Pendiente',  classes: 'bg-amber-900/40 text-amber-400 border border-amber-800/40' },
  aprobado:   { label: 'Aprobado',   classes: 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/40' },
  rechazado:  { label: 'Rechazado',  classes: 'bg-red-900/40 text-red-400 border border-red-800/40' },
};

export default function AsesorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('nueva');
  const [userId, setUserId] = useState<string | null>(null);
  const [nombreAsesor, setNombreAsesor] = useState('');
  const [telefonoAsesor, setTelefonoAsesor] = useState('');
  const [gpsEstado, setGpsEstado] = useState<GpsEstado>('inactivo');

  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [solicitudesCargadas, setSolicitudesCargadas] = useState(false);

  const router = useRouter();

  // ── Hash → activeTab ──────────────────────────────────────
  useEffect(() => {
    const readHash = () => {
      const h = window.location.hash.slice(1) as Tab;
      const valid: Tab[] = ['nueva', 'solicitudes', 'perfil'];
      setActiveTab(valid.includes(h) ? h : 'nueva');
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  // ── Auth + perfil ─────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUserId(data.user.id);

      const { data: perfil } = await supabase
        .from('profiles')
        .select('nombre_completo, telefono')
        .eq('id', data.user.id)
        .single();

      if (perfil) {
        setNombreAsesor(perfil.nombre_completo || '');
        setTelefonoAsesor(perfil.telefono || '');
      }
    });
  }, []);

  // ── Cargar solicitudes al entrar al tab por primera vez ───
  useEffect(() => {
    if (activeTab === 'solicitudes' && !solicitudesCargadas && userId) {
      cargarSolicitudes();
    }
  }, [activeTab, userId]);

  const cargarSolicitudes = async () => {
    if (!userId) return;
    setLoadingSolicitudes(true);
    try {
      const { data } = await supabase
        .from('solicitudes')
        .select('id, nombre_prospecto, monto_solicitado, estado, created_at')
        .eq('asesor_id', userId)
        .order('created_at', { ascending: false });
      if (data) setSolicitudes(data);
    } finally {
      setSolicitudesCargadas(true);
      setLoadingSolicitudes(false);
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const gpsInfo: Record<GpsEstado, { label: string; color: string }> = {
    activo:      { label: 'GPS activo — ubicación en vivo',          color: 'text-blue-400' },
    inactivo:    { label: 'Iniciando GPS...',                         color: 'text-gray-500' },
    error:       { label: 'No se pudo obtener ubicación',             color: 'text-red-400' },
    sin_soporte: { label: 'GPS no disponible en este dispositivo',    color: 'text-gray-500' },
  };

  return (
    <main className="min-h-screen bg-gray-950 pb-24">

      {/* GeoTracker invisible */}
      {userId && <GeoTracker userId={userId} onStatusChange={setGpsEstado} />}

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-white font-black text-lg leading-tight">
              Credi <span className="text-yellow-500">Asesor</span>
            </h1>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${gpsEstado === 'activo' ? 'bg-blue-500 animate-pulse' : gpsEstado === 'error' ? 'bg-red-400' : 'bg-gray-600'}`}
              title={gpsInfo[gpsEstado].label}
            />
          </div>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest">Captura de Campo</p>
        </div>
        <UserNav />
      </header>

      {/* ── CONTENIDO POR TAB ── */}
      <div className="px-4 pt-5 max-w-xl mx-auto">

        {/* ════ TAB: NUEVA ════ */}
        {activeTab === 'nueva' && (
          <AsesorForm userId={userId} />
        )}

        {/* ════ TAB: SOLICITUDES ════ */}
        {activeTab === 'solicitudes' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-bold text-base">Solicitudes Enviadas</h2>
                <p className="text-gray-500 text-xs">Historial de prospectos capturados</p>
              </div>
              {solicitudesCargadas && (
                <button
                  onClick={() => { setSolicitudesCargadas(false); cargarSolicitudes(); }}
                  className="text-gray-500 hover:text-yellow-400 transition-colors"
                  title="Actualizar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {loadingSolicitudes ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <LumaSpin />
              </div>
            ) : solicitudes.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl text-center py-12 px-6">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-gray-300 font-medium">Sin solicitudes enviadas</p>
                <p className="text-gray-500 text-sm mt-1">Las solicitudes que captures aparecerán aquí.</p>
                <button
                  onClick={() => { window.location.hash = ''; setActiveTab('nueva'); }}
                  className="mt-4 px-4 py-2 bg-yellow-500 text-gray-950 text-sm font-bold rounded-xl"
                >
                  Capturar prospecto
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {solicitudes.map((sol) => {
                  const badge = ESTADO_BADGE[sol.estado] ?? ESTADO_BADGE.pendiente;
                  const fecha = new Date(sol.created_at).toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  });
                  return (
                    <div key={sol.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm leading-tight truncate">
                            {sol.nombre_prospecto}
                          </p>
                          <p className="text-gray-500 text-xs mt-0.5">{fecha}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </div>
                      {sol.monto_solicitado > 0 && (
                        <p className="text-yellow-500 font-bold text-base mt-2">
                          ${Number(sol.monto_solicitado).toLocaleString('es-MX')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ TAB: PERFIL ════ */}
        {activeTab === 'perfil' && (
          <div>
            <div className="mb-5">
              <h2 className="text-white font-bold text-base">Mi Perfil</h2>
            </div>

            {/* Datos */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center text-gray-950 font-black text-xl shrink-0">
                  {(nombreAsesor || 'A')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-bold text-base leading-tight">{nombreAsesor || 'Asesor'}</p>
                  <span className="text-xs text-gray-950 bg-yellow-500 px-2 py-0.5 rounded-full font-bold">Asesor</span>
                </div>
              </div>

              {telefonoAsesor && (
                <a href={`tel:${telefonoAsesor}`} className="flex items-center gap-3 py-2.5 border-t border-gray-800">
                  <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Teléfono</p>
                    <p className="text-gray-300 text-sm">{telefonoAsesor}</p>
                  </div>
                </a>
              )}

              <div className="flex items-center gap-3 py-2.5 border-t border-gray-800">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rastreo GPS</p>
                  <p className={`text-sm font-medium ${gpsInfo[gpsEstado].color}`}>{gpsInfo[gpsEstado].label}</p>
                </div>
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-3">Mis solicitudes</p>
              <div className="grid grid-cols-3 gap-3">
                {(['pendiente', 'aprobado', 'rechazado'] as const).map((estado) => {
                  const count = solicitudesCargadas
                    ? solicitudes.filter((s) => s.estado === estado).length
                    : '—';
                  const b = ESTADO_BADGE[estado];
                  return (
                    <div key={estado} className="text-center">
                      <p className={`text-xl font-black ${estado === 'aprobado' ? 'text-emerald-400' : estado === 'rechazado' ? 'text-red-400' : 'text-amber-400'}`}>
                        {count}
                      </p>
                      <p className="text-gray-600 text-[10px] capitalize">{b.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={cerrarSesion}
              className="w-full border-2 border-red-900 text-red-400 py-3 rounded-xl text-sm font-semibold active:bg-red-950 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
