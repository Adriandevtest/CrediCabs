'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkNative = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        setIsNative(Capacitor.isNativePlatform());
      } catch {
        setIsNative(false);
      }
    };
    checkNative();
  }, []);

  const handleSignIn = async () => {
    if (!email || !password) {
      setErrorMsg('Por favor ingresa tu ID (o correo) y contraseña.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Sin @ → número de cliente (CLI-XXXX); construir email automáticamente
      const emailAuth = email.includes('@') ? email : `${email}@credicabs.com`;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailAuth,
        password,
      });

      if (authError) throw new Error('Credenciales incorrectas.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', authData.user.id)
        .single();

      if (profile?.rol === 'cobrador') return router.push('/cobrador');
      if (profile?.rol === 'supervisor') return router.push('/supervisor');
      if (profile?.rol === 'cliente') return router.push('/panel-cliente');
      return router.push('/');
    } catch {
      setErrorMsg('Acceso denegado. Verifica tu ID o contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (focused: boolean) => ({
    background: focused ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${focused ? 'rgba(213,0,0,0.5)' : 'rgba(255,255,255,0.08)'}`,
    boxShadow: focused ? '0 0 0 3px rgba(213,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
    color: '#fff',
    outline: 'none',
    transition: 'all 0.2s ease',
  });

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#000000' }}
    >
      {/* Ambient glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 90% 50% at 50% -5%, rgba(213,0,0,0.18) 0%, transparent 65%), ' +
            'radial-gradient(ellipse 60% 30% at 50% 105%, rgba(244,176,0,0.06) 0%, transparent 60%)',
        }}
      />

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
        }}
      />

      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(213,0,0,0.6), transparent)' }}
      />

      <motion.div
        className="relative z-10 w-full flex flex-col items-center px-6"
        style={{ maxWidth: 380 }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* ── Logo ── */}
        <motion.div
          className="mb-7 flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="relative mb-5">
            {/* Red glow ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow:
                  '0 0 0 1px rgba(213,0,0,0.4), 0 0 32px 6px rgba(213,0,0,0.3), 0 0 64px 16px rgba(213,0,0,0.12)',
              }}
            />
            <div
              className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                background: 'rgba(20,0,0,0.8)',
                border: '1.5px solid rgba(213,0,0,0.5)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Image
                src="/logo.png"
                alt="Credi Cab's"
                width={96}
                height={96}
                priority
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const el = e.currentTarget.parentElement!;
                  el.innerHTML = '<i class="fa-solid fa-taxi text-3xl" style="color:#D50000"></i>';
                }}
              />
            </div>
          </div>

          {/* Brand name */}
          <div className="text-center leading-none">
            <span
              className="block font-black text-white"
              style={{ fontSize: 32, letterSpacing: '-0.5px', textShadow: '0 2px 20px rgba(255,255,255,0.12)' }}
            >
              Credi Cab's
            </span>
            <span
              className="block font-extrabold italic mt-1"
              style={{
                fontSize: 20,
                color: '#F4B000',
                letterSpacing: '5px',
                textShadow: '0 0 20px rgba(244,176,0,0.5)',
              }}
            >
              MÓVIL
            </span>
          </div>

          <p
            className="mt-3 text-xs font-medium tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.22)' }}
          >
            Servicios Financieros
          </p>
        </motion.div>

        {/* ── Glass card ── */}
        <motion.div
          className="w-full rounded-3xl p-6"
          style={{
            background:
              'linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)',
            backdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow:
              '0 40px 80px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.07) inset',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          {/* Email field */}
          <div className="relative mb-3">
            <div
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 flex items-center justify-center"
              style={{ color: emailFocused ? 'rgba(213,0,0,0.8)' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}
            >
              <i className="fa-solid fa-envelope text-sm" />
            </div>
            <input
              type="text"
              placeholder="Correo o ID de cliente"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
              className="w-full pl-11 pr-4 py-[14px] text-sm rounded-2xl placeholder:text-[rgba(255,255,255,0.28)]"
              style={inputStyle(emailFocused)}
            />
          </div>

          {/* Password field */}
          <div className="relative mb-5">
            <div
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 flex items-center justify-center"
              style={{ color: passwordFocused ? 'rgba(213,0,0,0.8)' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}
            >
              <i className="fa-solid fa-lock text-sm" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Contraseña (clientes: tu No. cliente)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
              className="w-full pl-11 pr-11 py-[14px] text-sm rounded-2xl placeholder:text-[rgba(255,255,255,0.28)]"
              style={inputStyle(passwordFocused)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
            </button>
          </div>

          {/* Error */}
          {errorMsg && (
            <motion.div
              className="mb-4 px-4 py-3 rounded-2xl text-xs flex items-center gap-2"
              style={{
                background: 'rgba(213,0,0,0.12)',
                border: '1px solid rgba(213,0,0,0.3)',
                color: '#ff7070',
              }}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <i className="fa-solid fa-triangle-exclamation shrink-0" />
              {errorMsg}
            </motion.div>
          )}

          {/* Login button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-white text-sm tracking-[2px] uppercase transition-all active:scale-[0.97] disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #D50000 0%, #9b0000 100%)',
              boxShadow: loading
                ? 'none'
                : '0 0 28px rgba(213,0,0,0.45), 0 6px 20px rgba(213,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin" />
                Verificando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-right-to-bracket" />
                Iniciar sesión
              </span>
            )}
          </button>
        </motion.div>

        {/* Forgot password */}
        <motion.button
          className="mt-5 text-sm font-semibold transition-opacity hover:opacity-70 active:opacity-50"
          style={{ color: '#F4B000', textShadow: '0 0 12px rgba(244,176,0,0.35)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          ¿Olvidaste tu contraseña?
        </motion.button>

        {/* Biometric — native mobile only */}
        {isNative && (
          <motion.div
            className="mt-7 flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-3 w-40">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)', whiteSpace: 'nowrap' }}>
                o accede con
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <button
              className="flex flex-col items-center gap-2 group"
              aria-label="Acceso biométrico"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 group-hover:scale-105"
                style={{
                  background: 'rgba(244,176,0,0.06)',
                  border: '1.5px solid rgba(244,176,0,0.3)',
                  boxShadow: '0 0 24px rgba(244,176,0,0.12)',
                }}
              >
                <i className="fa-solid fa-fingerprint text-3xl" style={{ color: '#F4B000' }} />
              </div>
              <span className="text-xs font-medium" style={{ color: 'rgba(244,176,0,0.7)' }}>
                Huella digital
              </span>
            </button>
          </motion.div>
        )}

        {/* Footer */}
        <motion.p
          className="mt-8 text-xs"
          style={{ color: 'rgba(255,255,255,0.14)', letterSpacing: '0.5px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          © 2025 Credi Cab's · Todos los derechos reservados
        </motion.p>
      </motion.div>
    </div>
  );
}
