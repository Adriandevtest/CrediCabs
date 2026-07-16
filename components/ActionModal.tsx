'use client';

import { useState } from 'react';
import RegisterClientForm from './RegisterClientForm';
import RegisterCobradorForm from './RegisterCobradorForm';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cobradores: any[];
}

export default function ActionModal({ isOpen, onClose, cobradores }: ActionModalProps) {
  const [step, setStep] = useState<'select' | 'cliente' | 'cliente-existente' | 'cobrador'>('select');

  if (!isOpen) return null;

  const handleClose = () => {
    setStep('select');
    onClose();
  };

  const titulos: Record<typeof step, string> = {
    select: 'Nuevo Registro',
    cliente: 'Alta de Cliente',
    'cliente-existente': 'Cliente Existente',
    cobrador: 'Alta de Cobrador',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="bg-gray-950 border border-red-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90dvh' }}
      >
        {/* Cabecera fija */}
        <div className="shrink-0 p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 rounded-t-2xl md:rounded-t-2xl">
          <h2 className="text-xl font-bold text-white uppercase tracking-widest">
            {titulos[step]}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Contenido desplazable — min-h-0 necesario para que flex+overflow funcione */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {step === 'select' && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setStep('cliente')}
                className="group p-8 border border-gray-800 rounded-xl hover:border-red-600 transition-all bg-gray-900 text-center"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">👤</div>
                <h3 className="text-white font-bold text-lg mb-1">Nuevo Cliente</h3>
                <p className="text-gray-400 text-sm">Registrar préstamo y generar pagos.</p>
              </button>
              <button
                onClick={() => setStep('cobrador')}
                className="group p-8 border border-gray-800 rounded-xl hover:border-yellow-500 transition-all bg-gray-900 text-center"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">⚡</div>
                <h3 className="text-white font-bold text-lg mb-1">Nuevo Cobrador</h3>
                <p className="text-gray-400 text-sm">Añadir personal al equipo de campo.</p>
              </button>
              <button
                onClick={() => setStep('cliente-existente')}
                className="group p-8 border border-gray-800 rounded-xl hover:border-blue-500 transition-all bg-gray-900 text-center md:col-span-2"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📋</div>
                <h3 className="text-white font-bold text-lg mb-1">Cliente Existente</h3>
                <p className="text-gray-400 text-sm">Dar de alta un cliente que ya traías en papel, con días de pago ya cubiertos.</p>
              </button>
            </div>
          )}

          {step === 'cliente' && (
            <div>
              <RegisterClientForm cobradores={cobradores} />
              <div className="px-6 pb-6">
                <button onClick={() => setStep('select')} className="text-gray-500 text-sm hover:underline">← Volver atrás</button>
              </div>
            </div>
          )}

          {step === 'cliente-existente' && (
            <div>
              <RegisterClientForm cobradores={cobradores} existente />
              <div className="px-6 pb-6">
                <button onClick={() => setStep('select')} className="text-gray-500 text-sm hover:underline">← Volver atrás</button>
              </div>
            </div>
          )}

          {step === 'cobrador' && (
            <div className="p-6">
              <RegisterCobradorForm onCobradorAdded={handleClose} />
              <button onClick={() => setStep('select')} className="mt-4 text-gray-500 text-sm hover:underline">← Volver atrás</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

