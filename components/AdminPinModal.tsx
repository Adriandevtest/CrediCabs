'use client';

import { useEffect, useRef, useState } from 'react';
import { OTPInput, SlotProps } from 'input-otp';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  titulo?: string;
  descripcion?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AdminPinModal({
  open,
  titulo = 'Verificación requerida',
  descripcion = 'Ingresa el PIN de administrador para continuar.',
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState('');
  const [estado, setEstado] = useState<'idle' | 'verificando' | 'error' | 'ok'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setEstado('idle');
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const verificar = async (pin: string) => {
    setEstado('verificando');
    try {
      const res = await fetch('/api/admin/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (json.ok) {
        setEstado('ok');
        setTimeout(() => onConfirm(), 400);
      } else {
        setEstado('error');
        setValue('');
        setTimeout(() => {
          setEstado('idle');
          inputRef.current?.focus();
        }, 1200);
      }
    } catch {
      setEstado('error');
      setValue('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Card */}
      <div className="relative z-10 bg-gray-950 border border-gray-800 rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl">
        {/* Icono */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-colors ${
          estado === 'ok' ? 'bg-emerald-900/50' :
          estado === 'error' ? 'bg-red-900/50' :
          'bg-red-950/60'
        }`}>
          <i className={`fa-solid text-2xl ${
            estado === 'ok' ? 'fa-circle-check text-emerald-400' :
            estado === 'error' ? 'fa-circle-xmark text-red-400' :
            'fa-shield-halved text-red-500'
          }`} />
        </div>

        <h2 className="text-white font-black text-lg text-center mb-1">
          {estado === 'ok' ? '¡Acceso concedido!' : titulo}
        </h2>
        <p className="text-gray-500 text-sm text-center mb-7">
          {estado === 'ok'
            ? 'Ejecutando acción...'
            : estado === 'error'
            ? 'PIN incorrecto. Inténtalo de nuevo.'
            : descripcion}
        </p>

        {/* OTP Input */}
        {estado !== 'ok' && (
          <div className="flex justify-center mb-6">
            <OTPInput
              ref={inputRef}
              value={value}
              onChange={setValue}
              maxLength={4}
              disabled={estado === 'verificando'}
              containerClassName="flex items-center gap-3"
              onComplete={(v) => verificar(v)}
              render={({ slots }) => (
                <div className="flex gap-3">
                  {slots.map((slot, i) => (
                    <PinSlot key={i} slot={slot} error={estado === 'error'} />
                  ))}
                </div>
              )}
            />
          </div>
        )}

        {estado === 'verificando' && (
          <p className="text-center text-gray-500 text-xs mb-4">
            <i className="fa-solid fa-spinner fa-spin mr-1" />
            Verificando...
          </p>
        )}

        <button
          onClick={onCancel}
          className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function PinSlot({ slot, error }: { slot: SlotProps; error: boolean }) {
  return (
    <div
      className={cn(
        'w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all duration-150',
        slot.isActive
          ? 'border-red-500 bg-red-950/30 shadow-[0_0_0_3px_rgba(213,0,0,0.15)]'
          : error
          ? 'border-red-700 bg-red-950/20 text-red-400'
          : 'border-gray-700 bg-gray-900 text-white',
      )}
    >
      {slot.char !== null ? (
        <span>{slot.char}</span>
      ) : (
        slot.hasFakeCaret && (
          <span className="w-0.5 h-5 bg-red-500 animate-pulse rounded-full" />
        )
      )}
    </div>
  );
}
