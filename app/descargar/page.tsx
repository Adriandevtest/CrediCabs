import type { Metadata } from 'next';
import Link from 'next/link';
import { CinematicHero } from '@/components/ui/cinematic-landing-hero';

export const metadata: Metadata = {
  title: 'Descargar CrediCabs',
  description: 'Descarga la aplicación CrediCabs para gestionar tus créditos desde tu celular.',
};

const APK_URL = 'https://pnesuibfgtescgudkerf.supabase.co/storage/v1/object/public/expedientes/app/credicabs-latest.apk';

const features = [
  { icon: 'fa-bolt',          title: 'Pagos al instante',     desc: 'Registra y confirma pagos en segundos desde cualquier lugar.' },
  { icon: 'fa-bell',          title: 'Notificaciones reales',  desc: 'Recibe alertas en tu celular cuando un cliente realiza un pago.' },
  { icon: 'fa-camera',        title: 'Comprobantes con foto',  desc: 'Adjunta fotos del comprobante directamente desde la cámara.' },
  { icon: 'fa-map-location-dot', title: 'Mapa en vivo',       desc: 'Visualiza la ubicación de cobradores en tiempo real.' },
  { icon: 'fa-chart-line',    title: 'Control total',          desc: 'Seguimiento de créditos, morosidad y cobranza desde tu equipo.' },
  { icon: 'fa-shield-halved', title: 'Seguro y confiable',    desc: 'Tus datos protegidos con cifrado y acceso por roles.' },
];

const steps = [
  { n: '1', text: 'Descarga el archivo APK pulsando el botón de arriba.' },
  { n: '2', text: 'Abre el archivo desde tus notificaciones o el explorador de archivos.' },
  { n: '3', text: 'Si tu celular lo pide, permite instalar desde "fuentes desconocidas" en Ajustes.' },
  { n: '4', text: 'Instala la app, inicia sesión y empieza a gestionar tu cobranza.' },
];

export default function DescargarPage() {
  return (
    <div className="bg-gray-950 text-white font-sans">

      {/* ── Hero cinemático — solo desktop ─────────────────────── */}
      <div className="hidden md:block">
        <CinematicHero metricValue={1247} />
      </div>

      {/* ── Hero estático — solo móvil ──────────────────────────── */}
      <div className="md:hidden">
        <nav className="fixed top-0 inset-x-0 z-50 bg-gray-950/80 backdrop-blur border-b border-gray-900">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-yellow-500 flex items-center justify-center">
                <i className="fa-solid fa-taxi text-gray-950 text-sm" />
              </div>
              <span className="font-black text-lg tracking-tight">Credi<span className="text-yellow-400">Cabs</span></span>
            </div>
            <a href={APK_URL} download="credicabs.apk"
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-gray-950 font-bold text-sm px-4 py-2 rounded-xl transition-colors">
              <i className="fa-solid fa-download" />
              Descargar
            </a>
          </div>
        </nav>

        <section className="pt-32 pb-20 px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
              <i className="fa-solid fa-circle text-[6px] animate-pulse" />
              Disponible para Android
            </div>
            <h1 className="text-5xl font-black leading-tight mb-4">
              Tu cobranza,<br />
              <span className="text-yellow-400">en la palma de tu mano</span>
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed mb-10">
              CrediCabs es la app de gestión de créditos diseñada para cobradores, asesores y administradores.
              Rápida, confiable y con notificaciones en tiempo real.
            </p>
            <a href={APK_URL} download="credicabs.apk"
              className="inline-flex items-center gap-3 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300 text-gray-950 font-black text-lg px-8 py-4 rounded-2xl transition-all shadow-lg shadow-yellow-500/20 hover:shadow-yellow-400/30 hover:-translate-y-0.5">
              <i className="fa-solid fa-download text-xl" />
              Descargar APK
              <span className="text-xs font-bold opacity-60 ml-1">v1.0 · 15.6 MB</span>
            </a>
            <p className="text-gray-600 text-xs mt-4">
              <i className="fa-brands fa-android mr-1" />
              Android 7.0 o superior · Gratis
            </p>
          </div>

          <div className="mt-16 relative max-w-xs mx-auto">
            <div className="w-48 h-80 mx-auto bg-gray-900 rounded-[2.5rem] border-4 border-gray-800 shadow-2xl shadow-black/60 flex flex-col overflow-hidden">
              <div className="bg-gray-900 pt-6 pb-3 px-4 flex items-center justify-between shrink-0">
                <span className="text-[10px] text-gray-500">9:41</span>
                <div className="flex gap-1">
                  <i className="fa-solid fa-signal text-[8px] text-gray-500" />
                  <i className="fa-solid fa-wifi text-[8px] text-gray-500" />
                  <i className="fa-solid fa-battery-full text-[8px] text-gray-500" />
                </div>
              </div>
              <div className="flex-1 bg-gray-950 px-3 py-2 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black text-white">CrediCabs</span>
                  <div className="w-4 h-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <i className="fa-solid fa-bell text-yellow-400 text-[6px]" />
                  </div>
                </div>
                {[85, 60, 40, 75].map((w, i) => (
                  <div key={i} className="bg-gray-900 rounded-xl p-2 flex gap-2 items-center">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-user text-yellow-400 text-[7px]" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="h-1.5 bg-gray-700 rounded-full" style={{ width: `${w}%` }} />
                      <div className="h-1 bg-gray-800 rounded-full w-1/2" />
                    </div>
                  </div>
                ))}
                <div className="mt-auto flex justify-around py-1 border-t border-gray-900">
                  {['fa-house', 'fa-users', 'fa-map', 'fa-gear'].map((ic, i) => (
                    <i key={i} className={`fa-solid ${ic} text-[9px] ${i === 0 ? 'text-yellow-400' : 'text-gray-600'}`} />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute inset-0 -z-10 blur-3xl opacity-20 bg-yellow-400 rounded-full scale-75" />
          </div>
        </section>
      </div>

      {/* ── Funcionalidades ────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-3">
            Todo lo que necesitas para cobrar mejor
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">
            Diseñada para el trabajo real en campo — funciona rápido, sin complicaciones.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title}
                   className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-yellow-500/30
                              hover:bg-gray-900/80 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20
                                flex items-center justify-center mb-4 group-hover:bg-yellow-500/20 transition-colors">
                  <i className={`fa-solid ${f.icon} text-yellow-400 text-sm`} />
                </div>
                <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo instalar ──────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-gray-900 bg-gray-900/30">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-3">
            Instalación en 4 pasos
          </h2>
          <p className="text-gray-500 text-center mb-12">Sin tienda de apps. Directo en tu celular.</p>
          <div className="space-y-4">
            {steps.map((s) => (
              <div key={s.n} className="flex items-start gap-4 bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div className="w-8 h-8 rounded-full bg-yellow-500 text-gray-950 font-black text-sm
                                flex items-center justify-center shrink-0">
                  {s.n}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed pt-1">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quiénes somos ──────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500 flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-taxi text-gray-950 text-2xl" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-4">Quiénes somos</h2>
          <p className="text-gray-400 leading-relaxed mb-6">
            <strong className="text-white">CrediCabs</strong> es un sistema de gestión de créditos y cobranza diseñado
            para empresas que necesitan control total sobre su cartera de clientes. Nació de la necesidad real
            de llevar el trabajo de campo al siguiente nivel: sin papeles, sin retrasos, con información al instante.
          </p>
          <p className="text-gray-400 leading-relaxed mb-10">
            Nuestro equipo combina tecnología moderna con el entendimiento profundo de cómo funciona la cobranza
            en México. Creemos que la herramienta correcta transforma no solo el trabajo, sino los resultados.
          </p>

          <div className="grid grid-cols-3 gap-6 max-w-md mx-auto mb-12">
            {[
              { n: '100%', label: 'En la nube' },
              { n: 'Real',  label: 'Tiempo real' },
              { n: '24/7',  label: 'Disponible' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-yellow-400 font-black text-2xl">{stat.n}</p>
                <p className="text-gray-500 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-gray-900 bg-gradient-to-b from-gray-950 to-gray-900">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">¿Listo para empezar?</h2>
          <p className="text-gray-400 mb-8">Descarga gratis y empieza a gestionar tu cobranza hoy mismo.</p>
          <a
            href={APK_URL}
            download="credicabs.apk"
            className="inline-flex items-center gap-3 bg-yellow-500 hover:bg-yellow-400
                       text-gray-950 font-black text-base px-8 py-4 rounded-2xl transition-all
                       shadow-lg shadow-yellow-500/20 hover:shadow-yellow-400/30 hover:-translate-y-0.5"
          >
            <i className="fa-solid fa-download" />
            Descargar CrediCabs
          </a>
          <p className="text-gray-600 text-xs mt-4">
            <i className="fa-brands fa-android mr-1" />
            Solo para Android · Gratis · Sin cuenta Google necesaria
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-900 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-yellow-500 flex items-center justify-center">
              <i className="fa-solid fa-taxi text-gray-950 text-[10px]" />
            </div>
            <span className="font-black text-sm">Credi<span className="text-yellow-400">Cabs</span></span>
          </div>
          <p className="text-gray-600 text-xs">© {new Date().getFullYear()} CrediCabs · Todos los derechos reservados</p>
          <Link href="/login" className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
            Acceso al sistema
          </Link>
        </div>
      </footer>

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
    </div>
  );
}
