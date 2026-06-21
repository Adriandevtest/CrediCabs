'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface ImportRow {
  nombre_completo: string;
  telefono?: string;
  direccion?: string;
  email?: string;
  cobrador: string;
  monto_total: number;
  pagos: number;
  tasa_interes: number;
  _cobrador_id?: string;
  _error?: string;
}

interface Props {
  cobradores: { id: string; nombre_completo: string }[];
  onImportDone?: () => void;
}

export default function ExcelImportExport({ cobradores, onImportDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; errors: string[] } | null>(null);
  const [exporting, setExporting] = useState(false);

  // ── EXPORTAR ─────────────────────────────────────────────────────────────
  const exportar = async () => {
    setExporting(true);
    try {
      const { data: clientes } = await supabase
        .from('clientes')
        .select(`
          numero_cliente, direccion,
          profiles ( nombre_completo, telefono, email ),
          cobrador:profiles!clientes_cobrador_asignado_id_fkey ( nombre_completo ),
          creditos (
            monto_total, monto_diario, tasa_interes_porcentaje,
            semanas_autorizadas, estado, fecha_inicio,
            pagos_diarios ( pagado )
          )
        `);

      if (!clientes?.length) { alert('No hay clientes para exportar.'); return; }

      const filas = clientes.flatMap((c: any) => {
        const creditos = c.creditos || [];
        if (!creditos.length) {
          return [{
            'No. Cliente': c.numero_cliente,
            'Nombre': c.profiles?.nombre_completo || '',
            'Teléfono': c.profiles?.telefono || '',
            'Email': c.profiles?.email || '',
            'Dirección': c.direccion || '',
            'Cobrador': (c.cobrador as any)?.nombre_completo || '',
            'Monto Total': '', 'Cuota Diaria': '', 'Tasa Interés %': '',
            'No. Pagos': '', 'Estado': '', 'Fecha Inicio': '',
            'Pagos Realizados': '', 'Pagos Pendientes': '',
          }];
        }
        return creditos.map((cr: any) => {
          const realizados = (cr.pagos_diarios || []).filter((p: any) => p.pagado).length;
          const pendientes = (cr.pagos_diarios || []).filter((p: any) => !p.pagado).length;
          return {
            'No. Cliente': c.numero_cliente,
            'Nombre': c.profiles?.nombre_completo || '',
            'Teléfono': c.profiles?.telefono || '',
            'Email': c.profiles?.email || '',
            'Dirección': c.direccion || '',
            'Cobrador': (c.cobrador as any)?.nombre_completo || '',
            'Monto Total': cr.monto_total,
            'Cuota Diaria': Math.round(cr.monto_diario),
            'Tasa Interés %': cr.tasa_interes_porcentaje,
            'No. Pagos': cr.semanas_autorizadas,
            'Estado': cr.estado || 'activo',
            'Fecha Inicio': cr.fecha_inicio || '',
            'Pagos Realizados': realizados,
            'Pagos Pendientes': pendientes,
          };
        });
      });

      const ws = XLSX.utils.json_to_sheet(filas);
      // Anchos de columna
      ws['!cols'] = [8,22,14,26,20,20,12,12,13,10,10,12,14,14].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
      XLSX.writeFile(wb, `credicabs-clientes-${new Date().toLocaleDateString('en-CA')}.xlsx`);
    } catch (e: any) {
      alert('Error al exportar: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  // ── PLANTILLA ────────────────────────────────────────────────────────────
  const descargarPlantilla = () => {
    const ejemplo = [{
      'Nombre Completo *': 'Ejemplo: Juan García López',
      'Teléfono': '5551234567',
      'Dirección': 'Calle Reforma 123, Col. Centro',
      'Email': 'juan@email.com',
      'Cobrador (nombre exacto) *': cobradores[0]?.nombre_completo || 'Nombre del cobrador',
      'Monto Total * ($)': 5000,
      'No. Pagos * (28 o 37)': 28,
      'Tasa Interés % *': 30,
    }];
    const ws = XLSX.utils.json_to_sheet(ejemplo);
    ws['!cols'] = [28,14,28,24,28,16,20,16].map(w => ({ wch: w }));
    // Pintar cabeceras con color (nota) — SheetJS CE no soporta estilos, pero el orden queda claro
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla-importar-clientes.xlsx');
  };

  // ── LEER ARCHIVO ─────────────────────────────────────────────────────────
  const leerArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        const parsed: ImportRow[] = rows.map((r, i) => {
          const nombre = (r['Nombre Completo *'] || r['Nombre Completo'] || '').toString().trim();
          const cobradorNombre = (r['Cobrador (nombre exacto) *'] || r['Cobrador'] || '').toString().trim();
          const monto = Number(r['Monto Total * ($)'] || r['Monto Total'] || 0);
          const pagos = Number(r['No. Pagos * (28 o 37)'] || r['No. Pagos'] || 0);
          const tasa = Number(r['Tasa Interés % *'] || r['Tasa Interés %'] || 0);

          const cobrador = cobradores.find(
            c => c.nombre_completo.toLowerCase() === cobradorNombre.toLowerCase()
          );

          let error = '';
          if (!nombre) error = 'Nombre requerido';
          else if (!cobrador) error = `Cobrador "${cobradorNombre}" no encontrado`;
          else if (!monto || monto <= 0) error = 'Monto inválido';
          else if (pagos !== 28 && pagos !== 37) error = 'Pagos debe ser 28 o 37';
          else if (tasa < 0 || tasa > 100) error = 'Tasa inválida';

          return {
            nombre_completo: nombre,
            telefono: (r['Teléfono'] || '').toString().trim() || undefined,
            direccion: (r['Dirección'] || '').toString().trim() || undefined,
            email: (r['Email'] || '').toString().trim() || undefined,
            cobrador: cobradorNombre,
            monto_total: monto,
            pagos,
            tasa_interes: tasa,
            _cobrador_id: cobrador?.id,
            _error: error,
          };
        });

        setPreview(parsed);
        setImportResult(null);
      } catch (err: any) {
        alert('Error al leer el archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // ── IMPORTAR ─────────────────────────────────────────────────────────────
  const confirmarImport = async () => {
    if (!preview) return;
    const validos = preview.filter(r => !r._error);
    if (!validos.length) return;

    setImporting(true);
    const errors: string[] = [];
    let ok = 0;

    for (const row of validos) {
      try {
        const res = await fetch('/api/admin/create-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre_completo: row.nombre_completo,
            telefono: row.telefono,
            direccion: row.direccion,
            email: row.email,
            cobrador_asignado_id: row._cobrador_id,
            monto_total: row.monto_total,
            semanas_autorizadas: row.pagos,
            tasa_interes_porcentaje: row.tasa_interes,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) errors.push(`${row.nombre_completo}: ${json.error}`);
        else ok++;
      } catch (e: any) {
        errors.push(`${row.nombre_completo}: ${e.message}`);
      }
    }

    setImportResult({ ok, errors });
    setPreview(null);
    setImporting(false);
    if (ok > 0) onImportDone?.();
  };

  const invalidos = preview?.filter(r => r._error) || [];
  const validos = preview?.filter(r => !r._error) || [];

  return (
    <div className="hidden md:block">
      {/* Botones principales */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={exportar}
          disabled={exporting}
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
        >
          <i className="fa-solid fa-file-arrow-down" />
          {exporting ? 'Exportando...' : 'Exportar Excel'}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
        >
          <i className="fa-solid fa-file-arrow-up" />
          Importar Excel
        </button>
        <button
          onClick={descargarPlantilla}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
        >
          <i className="fa-solid fa-table" />
          Plantilla
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={leerArchivo} />
      </div>

      {/* Resultado de import */}
      {importResult && (
        <div className={`mt-4 p-4 rounded-xl border text-sm ${importResult.errors.length === 0 ? 'bg-emerald-950/40 border-emerald-700' : 'bg-yellow-950/40 border-yellow-700'}`}>
          <p className="font-bold text-white mb-1">
            <i className={`fa-solid ${importResult.errors.length === 0 ? 'fa-circle-check text-emerald-400' : 'fa-triangle-exclamation text-yellow-400'} mr-2`} />
            {importResult.ok} cliente{importResult.ok !== 1 ? 's' : ''} importado{importResult.ok !== 1 ? 's' : ''} correctamente
            {importResult.errors.length > 0 && ` · ${importResult.errors.length} con error`}
          </p>
          {importResult.errors.map((e, i) => (
            <p key={i} className="text-red-400 text-xs mt-1">• {e}</p>
          ))}
        </div>
      )}

      {/* Vista previa antes de importar */}
      {preview && (
        <div className="mt-4 bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-sm">Vista previa — {preview.length} fila{preview.length !== 1 ? 's' : ''}</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                <span className="text-emerald-400 font-bold">{validos.length} válidos</span>
                {invalidos.length > 0 && <span className="text-red-400 font-bold ml-2">{invalidos.length} con error</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview(null)} className="text-gray-500 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={confirmarImport}
                disabled={importing || validos.length === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
              >
                {importing
                  ? <><i className="fa-solid fa-spinner fa-spin" /> Importando...</>
                  : <><i className="fa-solid fa-check" /> Importar {validos.length} cliente{validos.length !== 1 ? 's' : ''}</>}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-950 sticky top-0">
                <tr>
                  {['Estado','Nombre','Cobrador','Monto','Pagos','Tasa %','Teléfono'].map(h => (
                    <th key={h} className="text-left text-gray-400 font-bold px-4 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className={`border-t border-gray-800 ${r._error ? 'bg-red-950/20' : ''}`}>
                    <td className="px-4 py-2">
                      {r._error
                        ? <span className="text-red-400 font-bold" title={r._error}>✗ {r._error}</span>
                        : <span className="text-emerald-400 font-bold">✓</span>}
                    </td>
                    <td className="px-4 py-2 text-white font-medium whitespace-nowrap">{r.nombre_completo || <span className="text-red-400">—</span>}</td>
                    <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{r.cobrador}</td>
                    <td className="px-4 py-2 text-gray-300">${r.monto_total.toLocaleString('es-MX')}</td>
                    <td className="px-4 py-2 text-gray-300">{r.pagos}</td>
                    <td className="px-4 py-2 text-gray-300">{r.tasa_interes}%</td>
                    <td className="px-4 py-2 text-gray-400">{r.telefono || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
