'use client';

import { useRef, useState } from 'react';
import { OTPInput, SlotProps } from 'input-otp';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Paso = 'actual' | 'nuevo' | 'confirmar' | 'ok';

export default function CambiarPinModal({ open, onClose }: Props) {
  const [paso, setPaso] = useState<Paso>('actual');
  const [pinActual, setPinActual] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinConfirmar, setPinConfirmar] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetear = () => {
    setPaso('actual');
    setPinActual('');
    setPinNuevo('');
    setPinConfirmar('');
    setError('');
    setLoading(false);
    onClose();
  };

  const avanzar = async (valor: string) => {
    setError('');

    if (paso === 'actual') {
      // Verificar que el PIN actual sea correcto antes de pedir el nuevo
      setLoading(true);
      try {
        const res = await fetch('/api/admin/pin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: valor }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError('PIN actual incorrecto');
          setPinActual('');
          setTimeout(() => inputRef.current?.focus(), 50);
          return;
        }
        setPinActual(valor);
        setPaso('nuevo');
        setPinNuevo('');
        setTimeout(() => inputRef.current?.focus(), 50);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (paso === 'nuevo') {
      setPinNuevo(valor);
      setPaso('confirmar');
      setPinConfirmar('');
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    if (paso === 'confirmar') {
      if (valor !== pinNuevo) {
        setError('Los PINs no coinciden');
        setPinConfirmar('');
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }
      // Guardar
      setLoading(true);
      try {
        const res = await fetch('/api/admin/pin/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin_actual: pinActual, pin_nuevo: pinNuevo }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.error || 'Error al cambiar PIN');
          setPinConfirmar('');
          return;
        }
        setPaso('ok');
        setTimeout(() => resetear(), 2000);
      } finally {
        setLoading(false);
      }
    }
  };

  const titulos: Record<Paso, string> = {
    actual: 'Ingresa tu PIN actual',
    nuevo: 'Ingresa el PIN nuevo',
    confirmar: 'Confirma el PIN nuevo',
    ok: '¡PIN actualizado!',
  };
  const subtitulos: Record<Paso, string> = {
    actual: 'Necesitamos verificar tu identidad primero.',
    nuevo: 'Elige 4 dígitos para tu nuevo PIN de seguridad.',
    confirmar: 'Repite el nuevo PIN para confirmar.',
    ok: 'Tu PIN ha sido cambiado correctamente.',
  };

  const valorActual = paso === 'actual' ? pinActual : paso === 'nuevo' ? pinNuevo : pinConfirmar;
  const setValorActual = paso === 'actual' ? setPinActual : paso === 'nuevo' ? setPinNuevo : setPinConfirmar;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={resetear} />
      <div className="relative z-10 bg-gray-950 border border-gray-800 rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl">
        {/* Pasos */}
        <div className="flex gap-1.5 justify-center mb-6">
          {(['actual', 'nuevo', 'confirmar'] as Paso[]).map((p, i) => (
            <div
              key={p}
              className={`h-1 rounded-full transition-all duration-300 ${
                paso === 'ok' || ['actual','nuevo','confirmar'].indexOf(paso) > i
                  ? 'bg-red-500 w-10'
                  : paso === p
                  ? 'bg-red-500 w-10'
                  : 'bg-gray-700 w-6'
              }`}
            />
          ))}
        </div>

        {/* Icono */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${paso === 'ok' ? 'bg-emerald-900/50' : 'bg-red-950/60'}`}>
          <i className={`fa-solid text-2xl ${paso === 'ok' ? 'fa-circle-check text-emerald-400' : 'fa-key text-red-500'}`} />
        </div>

        <h2 className="text-white font-black text-lg text-center mb-1">{titulos[paso]}</h2>
        <p className="text-gray-500 text-sm text-center mb-7">{subtitulos[paso]}</p>

        {paso !== 'ok' && (
          <>
            <div className="flex justify-center mb-4">
              <OTPInput
                ref={inputRef}
                value={valorActual}
                onChange={setValorActual}
                maxLength={4}
                disabled={loading}
                containerClassName="flex items-center gap-3"
                onComplete={avanzar}
                render={({ slots }) => (
                  <div className="flex gap-3">
                    {slots.map((slot, i) => (
                      <PinSlot key={i} slot={slot} error={!!error} />
                    ))}
                  </div>
                )}
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center mb-3">
                <i className="fa-solid fa-circle-exclamation mr-1" />{error}
              </p>
            )}
            {loading && (
              <p className="text-gray-500 text-xs text-center mb-3">
                <i className="fa-solid fa-spinner fa-spin mr-1" />Verificando...
              </p>
            )}
          </>
        )}

        <button onClick={resetear} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors mt-2">
          {paso === 'ok' ? 'Cerrar' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}

function PinSlot({ slot, error }: { slot: SlotProps; error: boolean }) {
  return (
    <div className={cn(
      'w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all duration-150',
      slot.isActive
        ? 'border-red-500 bg-red-950/30 shadow-[0_0_0_3px_rgba(213,0,0,0.15)]'
        : error
        ? 'border-red-700 bg-red-950/20 text-red-400'
        : 'border-gray-700 bg-gray-900 text-white',
    )}>
      {slot.char !== null ? (
        <span>{slot.char}</span>
      ) : slot.hasFakeCaret ? (
        <span className="w-0.5 h-5 bg-red-500 animate-pulse rounded-full" />
      ) : null}
    </div>
  );
}
