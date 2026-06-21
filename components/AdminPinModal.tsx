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
      // Delay necesario para que el DOM monte el input antes de enfocar
      // En móvil, requestAnimationFrame da tiempo al navegador para renderizar
      requestAnimationFrame(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
      });
    }
  }, [open]);

  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
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

  const handleCancel = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onCancel();
  };

  if (!open) return null;

  return (
    // Contenedor: cubre toda la pantalla y bloquea TODOS los eventos hacia atrás
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      // Bloquar todos los eventos de puntero para que no pasen al contenido detrás
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Backdrop — clic fuera cierra */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onPointerDown={handleCancel}
      />

      {/* Card — stopPropagation para que clics internos no lleguen al backdrop */}
      <div
        className="relative z-10 bg-gray-950 border border-gray-800 rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Icono estado */}
        <div className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-colors',
          estado === 'ok'    ? 'bg-emerald-900/50' :
          estado === 'error' ? 'bg-red-900/50' : 'bg-red-950/60'
        )}>
          <i className={cn('fa-solid text-2xl',
            estado === 'ok'    ? 'fa-circle-check text-emerald-400' :
            estado === 'error' ? 'fa-circle-xmark text-red-400' :
            'fa-shield-halved text-red-500'
          )} />
        </div>

        <h2 className="text-white font-black text-lg text-center mb-1">
          {estado === 'ok' ? '¡Acceso concedido!' : titulo}
        </h2>
        <p className="text-gray-500 text-sm text-center mb-7">
          {estado === 'ok'    ? 'Ejecutando acción...' :
           estado === 'error' ? 'PIN incorrecto. Inténtalo de nuevo.' :
           descripcion}
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
              // autoFocus abre el teclado en móvil al montar el input
              autoFocus
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

        {/* Botón cancelar — área táctil grande para móvil */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleCancel}
          className="w-full text-gray-400 hover:text-white active:text-white text-sm font-medium py-3 mt-1 rounded-xl transition-colors active:bg-gray-800"
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
        'w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all duration-150 select-none',
        slot.isActive
          ? 'border-red-500 bg-red-950/30 shadow-[0_0_0_3px_rgba(213,0,0,0.15)]'
          : error
          ? 'border-red-700 bg-red-950/20 text-red-400'
          : 'border-gray-700 bg-gray-900 text-white',
      )}
    >
      {slot.char !== null ? (
        <span>{slot.char}</span>
      ) : slot.hasFakeCaret ? (
        <span className="w-0.5 h-5 bg-red-500 animate-pulse rounded-full" />
      ) : null}
    </div>
  );
}
