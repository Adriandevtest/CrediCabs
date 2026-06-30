"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const APK_URL =
  "https://pnesuibfgtescgudkerf.supabase.co/storage/v1/object/public/expedientes/app/credicabs-latest.apk";

const INJECTED_STYLES = `
  .gsap-reveal { visibility: hidden; }

  .film-grain {
    position: absolute; inset: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 50; opacity: 0.04; mix-blend-mode: overlay;
    background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>');
  }

  .bg-grid-cc {
    background-size: 60px 60px;
    background-image:
      linear-gradient(to right, rgba(234,179,8,0.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(234,179,8,0.06) 1px, transparent 1px);
    mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }

  .text-3d-cc {
    color: #f5f5f5;
    text-shadow:
      0 10px 30px rgba(234,179,8,0.25),
      0 2px 4px rgba(0,0,0,0.6);
  }

  .text-gold-matte {
    background: linear-gradient(180deg, #FDE047 0%, #CA8A04 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
    filter:
      drop-shadow(0px 8px 20px rgba(234,179,8,0.35))
      drop-shadow(0px 2px 4px rgba(0,0,0,0.5));
  }

  .text-card-silver {
    background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
    filter:
      drop-shadow(0px 12px 24px rgba(0,0,0,0.8))
      drop-shadow(0px 4px 8px rgba(0,0,0,0.6));
  }

  .premium-card {
    background: linear-gradient(145deg, #1a1200 0%, #0a0a0a 100%);
    box-shadow:
      0 40px 100px -20px rgba(0,0,0,0.95),
      0 20px 40px -20px rgba(0,0,0,0.8),
      inset 0 1px 2px rgba(234,179,8,0.15),
      inset 0 -2px 4px rgba(0,0,0,0.8);
    border: 1px solid rgba(234,179,8,0.08);
    position: relative;
  }

  .card-sheen {
    position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 50;
    background: radial-gradient(800px circle at var(--mouse-x,50%) var(--mouse-y,50%), rgba(234,179,8,0.07) 0%, transparent 40%);
    mix-blend-mode: screen; transition: opacity 0.3s ease;
  }

  .iphone-bezel {
    background-color: #111;
    box-shadow:
      inset 0 0 0 2px #52525B,
      inset 0 0 0 7px #000,
      0 40px 80px -15px rgba(0,0,0,0.9),
      0 15px 25px -5px rgba(0,0,0,0.7);
    transform-style: preserve-3d;
  }

  .hardware-btn {
    background: linear-gradient(90deg, #404040 0%, #171717 100%);
    box-shadow:
      -2px 0 5px rgba(0,0,0,0.8),
      inset -1px 0 1px rgba(255,255,255,0.15),
      inset 1px 0 2px rgba(0,0,0,0.8);
    border-left: 1px solid rgba(255,255,255,0.05);
  }

  .screen-glare {
    background: linear-gradient(110deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 45%);
  }

  .widget-depth {
    background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
    box-shadow:
      0 10px 20px rgba(0,0,0,0.3),
      inset 0 1px 1px rgba(255,255,255,0.04),
      inset 0 -1px 1px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.03);
  }

  .floating-ui-badge {
    background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.01) 100%);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow:
      0 0 0 1px rgba(234,179,8,0.15),
      0 25px 50px -12px rgba(0,0,0,0.8),
      inset 0 1px 1px rgba(255,255,255,0.12),
      inset 0 -1px 1px rgba(0,0,0,0.5);
  }

  .btn-apk {
    transition: all 0.4s cubic-bezier(0.25,1,0.5,1);
    background: linear-gradient(180deg, #FDE047 0%, #CA8A04 100%);
    color: #0a0a0a;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.1),
      0 2px 4px rgba(0,0,0,0.4),
      0 12px 24px -4px rgba(234,179,8,0.4),
      inset 0 1px 1px rgba(255,255,255,0.6),
      inset 0 -3px 6px rgba(0,0,0,0.15);
  }
  .btn-apk:hover {
    transform: translateY(-3px);
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.1),
      0 6px 12px -2px rgba(0,0,0,0.3),
      0 20px 32px -6px rgba(234,179,8,0.5),
      inset 0 1px 1px rgba(255,255,255,0.6),
      inset 0 -3px 6px rgba(0,0,0,0.15);
  }
  .btn-apk:active {
    transform: translateY(1px);
    background: linear-gradient(180deg, #CA8A04 0%, #A16207 100%);
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.15),
      0 1px 2px rgba(0,0,0,0.2),
      inset 0 3px 6px rgba(0,0,0,0.2);
  }

  .progress-ring {
    transform: rotate(-90deg);
    transform-origin: center;
    stroke-dasharray: 402;
    stroke-dashoffset: 402;
    stroke-linecap: round;
  }
`;

export interface CinematicHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  metricValue?: number;
}

export function CinematicHero({ metricValue = 1247, className, ...props }: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.scrollY > window.innerHeight * 2) return;
      cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(() => {
        if (mainCardRef.current && mockupRef.current) {
          const rect = mainCardRef.current.getBoundingClientRect();
          mainCardRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
          mainCardRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
          const xVal = (e.clientX / window.innerWidth - 0.5) * 2;
          const yVal = (e.clientY / window.innerHeight - 0.5) * 2;
          gsap.to(mockupRef.current, {
            rotationY: xVal * 12,
            rotationX: -yVal * 12,
            ease: "power3.out",
            duration: 1.2,
          });
        }
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    // Solo correr la animación en desktop
    if (window.innerWidth < 768) return;

    const isMobile = false;
    const scroller = document.querySelector("main") as HTMLElement | null;
    const vh = scroller ? scroller.clientHeight : window.innerHeight;

    const ctx = gsap.context(() => {
      gsap.set(".text-track", { autoAlpha: 0, y: 60, scale: 0.85, filter: "blur(20px)", rotationX: -20 });
      gsap.set(".text-days", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" });
      gsap.set(".main-card", { y: vh + 200, autoAlpha: 1 });
      gsap.set([".card-left-text", ".card-right-text", ".mockup-scroll-wrapper", ".floating-badge", ".phone-widget"], { autoAlpha: 0 });
      gsap.set(".cta-wrapper", { autoAlpha: 0, scale: 0.8, filter: "blur(30px)" });

      const introTl = gsap.timeline({ delay: 0.3 });
      introTl
        .to(".text-track", { duration: 1.8, autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", rotationX: 0, ease: "expo.out" })
        .to(".text-days", { duration: 1.4, clipPath: "inset(0 0% 0 0)", ease: "power4.inOut" }, "-=1.0");

      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          scroller: scroller ?? window,
          start: "top top",
          end: "+=7000",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      scrollTl
        .to([".hero-text-wrapper", ".bg-grid-cc"], { scale: 1.15, filter: "blur(20px)", opacity: 0.2, ease: "power2.inOut", duration: 2 }, 0)
        .to(".main-card", { y: 0, ease: "power3.inOut", duration: 2 }, 0)
        .to(".main-card", { width: "100%", height: "100%", borderRadius: "0px", ease: "power3.inOut", duration: 1.5 })
        .fromTo(".mockup-scroll-wrapper",
          { y: 300, z: -500, rotationX: 50, rotationY: -30, autoAlpha: 0, scale: 0.6 },
          { y: 0, z: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 2.5 }, "-=0.8"
        )
        .fromTo(".phone-widget", { y: 40, autoAlpha: 0, scale: 0.95 }, { y: 0, autoAlpha: 1, scale: 1, stagger: 0.15, ease: "back.out(1.2)", duration: 1.5 }, "-=1.5")
        .to(".progress-ring", { strokeDashoffset: 80, duration: 2, ease: "power3.inOut" }, "-=1.2")
        .to(".counter-val", { innerHTML: metricValue, snap: { innerHTML: 1 }, duration: 2, ease: "expo.out" }, "-=2.0")
        .fromTo(".floating-badge", { y: 100, autoAlpha: 0, scale: 0.7, rotationZ: -10 }, { y: 0, autoAlpha: 1, scale: 1, rotationZ: 0, ease: "back.out(1.5)", duration: 1.5, stagger: 0.2 }, "-=2.0")
        .fromTo(".card-left-text", { x: -50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: "power4.out", duration: 1.5 }, "-=1.5")
        .fromTo(".card-right-text", { x: 50, autoAlpha: 0, scale: 0.8 }, { x: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 1.5 }, "<")
        .to({}, { duration: 2.5 })
        .set(".hero-text-wrapper", { autoAlpha: 0 })
        .set(".cta-wrapper", { autoAlpha: 1 })
        .to({}, { duration: 1.5 })
        .to([".mockup-scroll-wrapper", ".floating-badge", ".card-left-text", ".card-right-text"], {
          scale: 0.9, y: -40, z: -200, autoAlpha: 0, ease: "power3.in", duration: 1.2, stagger: 0.05,
        })
        .to(".main-card", {
          width: isMobile ? "92vw" : "85vw",
          height: isMobile ? "92vh" : "85vh",
          borderRadius: isMobile ? "32px" : "40px",
          ease: "expo.inOut",
          duration: 1.8,
        }, "pullback")
        .to(".cta-wrapper", { scale: 1, filter: "blur(0px)", ease: "expo.inOut", duration: 1.8 }, "pullback")
        .to(".main-card", { y: -vh - 300, ease: "power3.in", duration: 1.5 });
    }, containerRef);

    return () => ctx.revert();
  }, [metricValue]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-screen h-screen overflow-hidden flex items-center justify-center bg-gray-950 text-white font-sans antialiased",
        className
      )}
      style={{ perspective: "1500px" }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      <div className="film-grain" aria-hidden="true" />
      <div className="bg-grid-cc absolute inset-0 z-0 pointer-events-none opacity-50" aria-hidden="true" />

      {/* Hero text */}
      <div className="hero-text-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 will-change-transform">
        <h1 className="text-track gsap-reveal text-3d-cc text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tight mb-2">
          Tu cobranza,
        </h1>
        <h1 className="text-days gsap-reveal text-gold-matte text-5xl md:text-7xl lg:text-[6rem] font-extrabold tracking-tighter">
          en tiempo real.
        </h1>
      </div>

      {/* CTA final */}
      <div className="cta-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 gsap-reveal pointer-events-auto will-change-transform">
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight text-gold-matte">
          Descarga la app.
        </h2>
        <p className="text-gray-400 text-lg md:text-xl mb-12 max-w-xl mx-auto font-light leading-relaxed">
          Gestiona créditos, registra pagos y recibe notificaciones al instante.
          Disponible gratis para Android.
        </p>
        <a
          href={APK_URL}
          download="credicabs.apk"
          className="btn-apk inline-flex items-center gap-4 px-10 py-5 rounded-[1.25rem] font-black text-lg focus:outline-none"
          aria-label="Descargar APK de CrediCabs"
        >
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 512 512" aria-hidden="true">
            <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
          </svg>
          <div className="text-left">
            <div className="text-[11px] font-bold tracking-widest uppercase opacity-70 mb-[-2px]">Descargar para</div>
            <div className="text-xl font-black leading-none tracking-tight">Android · Gratis</div>
          </div>
        </a>
        <p className="text-gray-600 text-xs mt-5">
          v1.0 · 15.6 MB · Android 7.0 o superior
        </p>
      </div>

      {/* Deep card */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: "1500px" }}>
        <div
          ref={mainCardRef}
          className="main-card premium-card relative overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]"
        >
          <div className="card-sheen" aria-hidden="true" />

          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-3 items-center lg:gap-8 z-10 py-6 lg:py-0">

            {/* Nombre de marca (arriba móvil / derecha desktop) */}
            <div className="card-right-text gsap-reveal order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
              <h2 className="text-5xl md:text-[5rem] lg:text-[7rem] font-black uppercase tracking-tighter text-card-silver">
                Credi<span style={{ color: "#EAB308" }}>Cabs</span>
              </h2>
            </div>

            {/* Mockup del celular (centro) */}
            <div className="mockup-scroll-wrapper order-2 relative w-full h-[380px] lg:h-[600px] flex items-center justify-center z-10" style={{ perspective: "1000px" }}>
              <div className="relative w-full h-full flex items-center justify-center transform scale-[0.65] md:scale-85 lg:scale-100">

                <div
                  ref={mockupRef}
                  className="relative w-[280px] h-[580px] rounded-[3rem] iphone-bezel flex flex-col will-change-transform"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Botones físicos */}
                  <div className="absolute top-[120px] -left-[3px] w-[3px] h-[25px] hardware-btn rounded-l-md" aria-hidden="true" />
                  <div className="absolute top-[160px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md" aria-hidden="true" />
                  <div className="absolute top-[220px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md" aria-hidden="true" />
                  <div className="absolute top-[170px] -right-[3px] w-[3px] h-[70px] hardware-btn rounded-r-md scale-x-[-1]" aria-hidden="true" />

                  {/* Pantalla */}
                  <div className="absolute inset-[7px] bg-[#050505] rounded-[2.5rem] overflow-hidden text-white z-10">
                    <div className="absolute inset-0 screen-glare z-40 pointer-events-none" aria-hidden="true" />

                    {/* Dynamic Island */}
                    <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-50 flex items-center justify-end px-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-pulse" />
                    </div>

                    {/* UI de la app */}
                    <div className="relative w-full h-full pt-12 px-5 pb-8 flex flex-col">
                      {/* Header */}
                      <div className="phone-widget flex justify-between items-center mb-6">
                        <div>
                          <span className="text-[10px] text-yellow-500/60 uppercase tracking-widest font-bold">Hoy</span>
                          <p className="text-xl font-bold text-white">Cobranza</p>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center font-bold text-yellow-400 text-sm">
                          A
                        </div>
                      </div>

                      {/* Contador circular — pagos del día */}
                      <div className="phone-widget relative w-44 h-44 mx-auto flex items-center justify-center mb-6 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">
                        <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                          <circle cx="88" cy="88" r="64" fill="none" stroke="rgba(234,179,8,0.08)" strokeWidth="12" />
                          <circle className="progress-ring" cx="88" cy="88" r="64" fill="none" stroke="#EAB308" strokeWidth="12" />
                        </svg>
                        <div className="text-center z-10">
                          <span className="counter-val text-4xl font-extrabold text-white">0</span>
                          <p className="text-[8px] text-yellow-400/50 uppercase tracking-[0.1em] font-bold mt-0.5">Clientes activos</p>
                        </div>
                      </div>

                      {/* Widgets de clientes */}
                      <div className="space-y-2.5">
                        <div className="phone-widget widget-depth rounded-2xl p-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 w-20 bg-neutral-300 rounded-full mb-1.5" />
                            <div className="h-1.5 w-12 bg-neutral-700 rounded-full" />
                          </div>
                          <span className="text-yellow-400 text-xs font-bold">+$850</span>
                        </div>
                        <div className="phone-widget widget-depth rounded-2xl p-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 w-16 bg-neutral-300 rounded-full mb-1.5" />
                            <div className="h-1.5 w-24 bg-neutral-700 rounded-full" />
                          </div>
                          <span className="text-emerald-400 text-xs font-bold">Aprobado</span>
                        </div>
                      </div>

                      {/* Home indicator */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-white/20 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Badge: pago registrado */}
                <div className="floating-badge absolute flex top-6 lg:top-12 left-[-15px] lg:left-[-80px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                    <span className="text-base lg:text-xl" aria-hidden="true">💰</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">Pago registrado</p>
                    <p className="text-yellow-400/50 text-[10px] lg:text-xs font-medium">$1,200 · hace 2 min</p>
                  </div>
                </div>

                {/* Badge: transferencia aprobada */}
                <div className="floating-badge absolute flex bottom-12 lg:bottom-20 right-[-15px] lg:right-[-80px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <span className="text-base lg:text-lg" aria-hidden="true">✅</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">Transferencia aprobada</p>
                    <p className="text-emerald-400/50 text-[10px] lg:text-xs font-medium">Crédito activado</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Texto izquierda / abajo móvil */}
            <div className="card-left-text gsap-reveal order-3 lg:order-1 flex flex-col justify-center text-center lg:text-left z-20 w-full px-4 lg:px-0">
              <h3 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-0 lg:mb-5 tracking-tight">
                Cobranza sin papel.
              </h3>
              <p className="hidden md:block text-yellow-100/50 text-sm md:text-base lg:text-lg font-normal leading-relaxed max-w-sm">
                <span className="text-white font-semibold">CrediCabs</span> conecta a cobradores, supervisores y administradores en una sola plataforma. Pagos, comprobantes y notificaciones en tiempo real, desde cualquier celular Android.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
