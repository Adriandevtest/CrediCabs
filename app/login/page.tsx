'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleSignIn = async () => {
    if (!email) {
      setErrorMsg('Por favor ingresa tu ID o Correo.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Intentar inicio de sesión estándar (Admin/Cobrador/Asesor)
      if (password) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!authError) {
          const { data: profile } = await supabase.from('profiles').select('rol').eq('id', authData.user.id).single();
          if (profile?.rol === 'cobrador') return router.push('/cobrador');
          if (profile?.rol === 'asesor') return router.push('/asesor');
          return router.push('/'); // Admin
        }
      }

      // 2. Si no es admin/staff, intentamos inicio de sesión como CLIENTE (solo ID)
      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('id, numero_cliente')
        .eq('numero_cliente', email)
        .single();

      if (cliente) {
        // "Logueamos" al cliente guardando su ID en local y enviándolo al panel
        localStorage.setItem('cliente_id', cliente.id);
        router.push('/panel-cliente');
        return;
      }

      throw new Error('Credenciales incorrectas o ID no encontrado.');
      
    } catch (error: any) {
      setErrorMsg('Acceso denegado. Verifica tu ID o contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden flex flex-col items-center justify-center" style={{ height: '100dvh' }}>
      {/* Fondo con position:absolute dentro del contenedor overflow-hidden — no se mueve en iOS */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/fondo.jpg')" }}
      />
      <div className="absolute inset-0 -z-[5] bg-black/60 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-sm mx-4 rounded-3xl bg-gradient-to-r from-[#ffffff15] to-[#12121280] backdrop-blur-md shadow-2xl p-8 flex flex-col items-center border border-white/10">
        
        <div className="flex items-center justify-center w-24 h-24 rounded-full bg-white/5 mb-4 shadow-lg border border-white/10 overflow-hidden">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=CC&background=EAB308&color=000&size=150"; }}/>
        </div>
        
        <h2 className="text-3xl font-black text-yellow-500 mb-6 text-center tracking-wide drop-shadow-md">
          Credi Cab's
        </h2>
        
        <div className="flex flex-col w-full gap-4">
          <div className="w-full flex flex-col gap-3">
            <input
              placeholder="Correo"
              type="text"
              value={email}
              className="w-full px-5 py-3 rounded-xl bg-black/40 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all border border-white/5"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
            />
            <input
              placeholder="Contraseña"
              type="password"
              value={password}
              className="w-full px-5 py-3 rounded-xl bg-black/40 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all border border-white/5"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
            />
            {errorMsg && (
              <div className="text-sm text-red-400 text-left bg-red-900/40 p-2 rounded-lg border border-red-500/50 backdrop-blur-sm">
                {errorMsg}
              </div>
            )}
          </div>
          
          <hr className="opacity-20 border-white my-1" />
          
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full bg-yellow-600/90 text-black font-bold px-5 py-3 rounded-full shadow-[0_0_15px_rgba(202,138,4,0.3)] hover:bg-yellow-500 transition-all text-sm flex justify-center items-center active:scale-95"
          >
            {loading ? 'Verificando...' : 'Iniciar sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}