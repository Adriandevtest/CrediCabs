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

  // Bloquear scroll del body + reset estado al abrir
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setValue('');
      setEstado('idle');
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Intentos de foco escalonados: desktop enfoca inmediatamente,
  // en iOS/Android los timeouts más largos cubren el retraso del render
  useEffect(() => {
    if (!open) return;
    const tryFocus = () => inputRef.current?.focus();
    tryFocus();
    const t1 = setTimeout(tryFocus, 80);
    const t2 = setTimeout(tryFocus, 200);
    const t3 = setTimeout(tryFocus, 450);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [open]);

  const focusInput = () => inputRef.current?.focus();

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
          focusInput();
        }, 1200);
      }
    } catch {
      setEstado('error');
      setValue('');
    }
  };

  const handleCancel = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onCancel();
  };

  if (!open) return null;

  return (
    // Capa exterior: bloquea TODOS los eventos hacia el contenido detrás
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onPointerDown={handleCancel}
      />

      {/* Tarjeta */}
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
          estado === 'error' ? 'bg-red-900/50'     : 'bg-red-950/60'
        )}>
          <i className={cn('fa-solid text-2xl',
            estado === 'ok'    ? 'fa-circle-check text-emerald-400' :
            estado === 'error' ? 'fa-circle-xmark text-red-400'     :
            'fa-shield-halved text-red-500'
          )} />
        </div>

        <h2 className="text-white font-black text-lg text-center mb-1">
          {estado === 'ok' ? '¡Acceso concedido!' : titulo}
        </h2>
        <p className="text-gray-500 text-sm text-center mb-7">
          {estado === 'ok'    ? 'Ejecutando acción...'                :
           estado === 'error' ? 'PIN incorrecto. Inténtalo de nuevo.' :
           descripcion}
        </p>

        {estado !== 'ok' && (
          <>
            {/*
              El wrapper con onClick/onTouchEnd→focusInput garantiza que al tocar
              cualquier parte del área de slots en móvil, se llame focus() dentro
              de un gesto de usuario real → el teclado se abre siempre.
              pointer-events-none en los slots visuales deja pasar el toque al wrapper.
            */}
            <div
              className="flex justify-center mb-2 cursor-text"
              onClick={focusInput}
              onTouchEnd={(e) => { e.stopPropagation(); focusInput(); }}
            >
              <OTPInput
                ref={inputRef}
                value={value}
                onChange={setValue}
                maxLength={4}
                disabled={estado === 'verificando'}
                containerClassName="flex items-center gap-3"
                onComplete={(v) => verificar(v)}
                autoFocus
                render={({ slots }) => (
                  <div className="flex gap-3 pointer-events-none select-none">
                    {slots.map((slot, i) => (
                      <PinSlot key={i} slot={slot} error={estado === 'error'} />
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Hint móvil — desaparece en cuanto el usuario empieza a escribir */}
            {value.length === 0 && estado === 'idle' && (
              <p className="text-center text-gray-600 text-[10px] mb-4 md:hidden animate-pulse">
                Toca los campos para abrir el teclado
              </p>
            )}
            {(value.length > 0 || estado !== 'idle') && <div className="mb-4" />}

            {estado === 'verificando' && (
              <p className="text-center text-gray-500 text-xs -mt-2 mb-2">
                <i className="fa-solid fa-spinner fa-spin mr-1" />
                Verificando...
              </p>
            )}
          </>
        )}

        {/* Cancelar */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleCancel}
          className="w-full text-gray-400 hover:text-white active:text-white text-sm font-medium py-3 rounded-xl transition-colors active:bg-gray-800"
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
      ) : slot.hasFakeCaret ? (
        <span className="w-0.5 h-5 bg-red-500 animate-pulse rounded-full" />
      ) : null}
    </div>
  );
}
