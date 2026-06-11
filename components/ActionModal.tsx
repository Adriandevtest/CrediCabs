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
  const [step, setStep] = useState<'select' | 'cliente' | 'cobrador'>('select');

  if (!isOpen) return null;

  const handleClose = () => {
    setStep('select');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-950 border border-red-900 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Cabecera de la Modal */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <h2 className="text-xl font-bold text-white uppercase tracking-widest">
            {step === 'select' ? 'Nuevo Registro' : step === 'cliente' ? 'Alta de Cliente' : 'Alta de Cobrador'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-6">
          {step === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => setStep('cliente')}
                className="group p-8 border border-gray-800 rounded-xl hover:border-red-600 transition-all bg-gray-900 text-center"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">👤</div>
                <h3 className="text-white font-bold text-lg mb-1">Nuevo Cliente</h3>
                <p className="text-gray-400 text-sm">Registrar préstamo y generar pagos diarios.</p>
              </button>

              <button 
                onClick={() => setStep('cobrador')}
                className="group p-8 border border-gray-800 rounded-xl hover:border-yellow-500 transition-all bg-gray-900 text-center"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">⚡</div>
                <h3 className="text-white font-bold text-lg mb-1">Nuevo Cobrador</h3>
                <p className="text-gray-400 text-sm">Añadir personal al equipo de campo.</p>
              </button>
            </div>
          )}

          {step === 'cliente' && (
            <div className="max-h-[70vh] overflow-y-auto pr-2">
              <RegisterClientForm cobradores={cobradores} />
              <button onClick={() => setStep('select')} className="mt-4 text-gray-500 text-sm hover:underline">← Volver atrás</button>
            </div>
          )}

          {step === 'cobrador' && (
            <div>
              <RegisterCobradorForm onCobradorAdded={handleClose} />
              <button onClick={() => setStep('select')} className="mt-4 text-gray-500 text-sm hover:underline">← Volver atrás</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

