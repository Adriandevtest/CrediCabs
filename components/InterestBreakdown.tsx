'use client';

interface InterestBreakdownProps {
  capital: number;
  interes: number;
  total: number;
  showTitle?: boolean;
  compact?: boolean;
}

export function InterestBreakdown({ capital, interes, total, showTitle = true, compact = false }: InterestBreakdownProps) {
  if (compact) {
    return (
      <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-sm space-y-1">
        {showTitle && <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Desglose</p>}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Capital</span>
          <span className="text-white font-semibold">${capital.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between items-center text-yellow-500/80">
          <span>+ Interés</span>
          <span className="font-semibold">${interes.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="border-t border-gray-800 pt-1 flex justify-between items-center">
          <span className="text-gray-300 font-bold">Total</span>
          <span className="text-white font-black">${total.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-gray-900/50 to-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
      {showTitle && <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Desglose de Pago</p>}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Capital:</span>
          <span className="text-white font-semibold">${capital.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-yellow-500/90 font-medium">+ Interés:</span>
          <span className="text-yellow-500 font-semibold">${interes.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
          <span className="text-white font-bold">= Total Diario:</span>
          <span className="text-white font-black text-lg">${total.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}
