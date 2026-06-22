"use client";

import { useState, useEffect, useRef } from "react";
import { Checkbox } from "./ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { supabase } from "../lib/supabase";
import { ImageLightbox } from "./ImageLightbox";
import AdminPinModal from "./AdminPinModal";

export default function TableWithDialog({ searchQuery, statusFilter = 'todos' }: { searchQuery: string, statusFilter?: string }) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [cobradores, setCobradores] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [eliminando, setEliminando] = useState(false);
  const [pinEliminarOpen, setPinEliminarOpen] = useState(false);
  const pendingDeleteRef = useRef<any>(null);
  const [verMas, setVerMas] = useState(false);
  const [detalleExtra, setDetalleExtra] = useState<any>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [nuevoCobrador, setNuevoCobrador] = useState('');
  const [reasignando, setReasignando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({ nombre_completo: '', telefono: '', direccion: '' });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [editCredito, setEditCredito] = useState({ monto_total: 0, num_pagos: 28 });
  const [guardandoCredito, setGuardandoCredito] = useState(false);
  const [showNuevoCredito, setShowNuevoCredito] = useState(false);
  const [nuevoCredito, setNuevoCredito] = useState({ monto_total: 0, num_pagos: 28, tasa: 0 });
  const [agregandoCredito, setAgregandoCredito] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    fetchClientes();
    fetchCobradores();
  }, []);

  // Preseleccionar datos cuando se abre el diálogo de un cliente
  useEffect(() => {
    if (selectedUser) {
      setNuevoCobrador(selectedUser.cobrador_asignado_id || '');
      setEditForm({
        nombre_completo: selectedUser.profiles?.nombre_completo || '',
        telefono: selectedUser.profiles?.telefono || '',
        direccion: selectedUser.direccion || '',
      });
      setEditando(false);
      setShowNuevoCredito(false);
      setNuevoCredito({ monto_total: 0, num_pagos: 28, tasa: 0 });
      const numPagos = [28, 37].includes(selectedUser.credito?.semanas_autorizadas)
        ? selectedUser.credito.semanas_autorizadas
        : 28;
      setEditCredito({
        monto_total: selectedUser.credito?.monto_total || 0,
        num_pagos: numPagos,
      });
    }
  }, [selectedUser?.id]);

  const fetchClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select(`
        id,
        numero_cliente,
        direccion,
        cobrador_asignado_id,
        profiles ( nombre_completo, telefono, foto_url, avatar_url, email ),
        creditos ( id, monto_total, monto_diario, estado, semanas_autorizadas )
      `)
      .order('numero_cliente', { ascending: false });

    if (data) setClientes(data);
  };

  const fetchCobradores = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nombre_completo')
      .eq('rol', 'cobrador')
      .order('nombre_completo', { ascending: true });
    if (data) setCobradores(data);
  };

  const reasignarCobrador = async () => {
    if (!selectedUser || !nuevoCobrador) return;
    if (nuevoCobrador === selectedUser.cobrador_asignado_id) {
      alert('Este cliente ya está asignado a ese cobrador.');
      return;
    }
    if (!confirm(`¿Reasignar a "${selectedUser.profiles?.nombre_completo}" al cobrador seleccionado?`)) return;

    setReasignando(true);
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ cobrador_asignado_id: nuevoCobrador })
        .eq('id', selectedUser.id);

      if (error) throw error;

      const nombreNuevo = cobradores.find(c => c.id === nuevoCobrador)?.nombre_completo || '';
      alert(`✅ Cliente reasignado a ${nombreNuevo} con éxito.`);

      // Actualizar estado local para reflejar el cambio sin recargar todo
      setSelectedUser((prev: any) => ({ ...prev, cobrador_asignado_id: nuevoCobrador }));
      fetchClientes();
    } catch (error: any) {
      alert('Error al reasignar: ' + error.message);
    } finally {
      setReasignando(false);
    }
  };

  const guardarEdicion = async () => {
    if (!selectedUser) return;
    setGuardandoEdicion(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ nombre_completo: editForm.nombre_completo, telefono: editForm.telefono })
        .eq('id', selectedUser.id);
      if (profileError) throw profileError;

      const { error: clienteError } = await supabase
        .from('clientes')
        .update({ direccion: editForm.direccion })
        .eq('id', selectedUser.id);
      if (clienteError) throw clienteError;

      setSelectedUser((prev: any) => ({
        ...prev,
        direccion: editForm.direccion,
        profiles: { ...prev.profiles, nombre_completo: editForm.nombre_completo, telefono: editForm.telefono },
      }));
      setEditando(false);
      fetchClientes();
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const agregarCredito = async () => {
    if (!selectedUser?.id || nuevoCredito.monto_total <= 0) return;
    if (!confirm(`¿Agregar nuevo crédito de $${nuevoCredito.monto_total.toLocaleString('es-MX')} con ${nuevoCredito.num_pagos} pagos diarios?`)) return;
    setAgregandoCredito(true);
    try {
      const tasa = nuevoCredito.tasa;
      const interesTotal = nuevoCredito.monto_total * (tasa / 100);
      const cuotaDiaria = (nuevoCredito.monto_total + interesTotal) / nuevoCredito.num_pagos;

      const { data: creditoData, error: creditoError } = await supabase
        .from('creditos')
        .insert({
          cliente_id: selectedUser.id,
          monto_total: nuevoCredito.monto_total,
          semanas_autorizadas: nuevoCredito.num_pagos,
          monto_diario: cuotaDiaria,
          tasa_interes_porcentaje: tasa,
          interes_total: interesTotal,
          fecha_inicio: new Date().toISOString().split('T')[0],
          estado: 'activo',
        })
        .select()
        .single();

      if (creditoError) throw creditoError;

      // Generar calendario lunes-viernes
      const fechaActual = new Date();
      while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
      const pagos = [];
      for (let i = 0; i < nuevoCredito.num_pagos; i++) {
        pagos.push({
          credito_id: creditoData.id,
          numero_dia: i + 1,
          fecha_esperada: new Date(fechaActual).toISOString().split('T')[0],
          pagado: false,
        });
        fechaActual.setDate(fechaActual.getDate() + 1);
        while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
          fechaActual.setDate(fechaActual.getDate() + 1);
        }
      }
      const { error: pagosError } = await supabase.from('pagos_diarios').insert(pagos);
      if (pagosError) throw pagosError;

      alert(`✅ Nuevo crédito creado. Pago diario: $${Math.round(cuotaDiaria).toLocaleString('es-MX')}`);
      setShowNuevoCredito(false);
      setNuevoCredito({ monto_total: 0, num_pagos: 28, tasa: 0 });
      fetchClientes();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setAgregandoCredito(false);
    }
  };

  const guardarCredito = async () => {
    if (!selectedUser?.credito?.id) return;
    if (!confirm(`¿Actualizar el crédito a $${editCredito.monto_total.toLocaleString('es-MX')} con ${editCredito.num_pagos} pagos diarios? Se eliminará el calendario anterior.`)) return;

    setGuardandoCredito(true);
    try {
      const res = await fetch('/api/admin/update-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credito_id: selectedUser.credito.id,
          monto_total: editCredito.monto_total,
          num_pagos: editCredito.num_pagos,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar');
      }

      const { monto_por_pago } = await res.json();
      alert(`✅ Crédito actualizado. Pago diario: $${Math.round(monto_por_pago).toLocaleString('es-MX')}`);

      setSelectedUser((prev: any) => ({
        ...prev,
        credito: {
          ...prev.credito,
          monto_total: editCredito.monto_total,
          semanas_autorizadas: editCredito.num_pagos,
          monto_diario: monto_por_pago,
        },
      }));
      fetchClientes();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setGuardandoCredito(false);
    }
  };

 const cargarDetalleExtra = async (clienteId: string) => {
  setCargandoDetalle(true);
  try {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('ine_url, comprobante_url, ocupacion, ingreso_mensual, telefono, direccion')
      .eq('cliente_id', clienteId)  // ✅ Cambiar a cliente_id
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('Detalle extra query:', { data, error, clienteId });
    setDetalleExtra(data || null);
  } catch {
    setDetalleExtra(null);
  } finally {
    setCargandoDetalle(false);
  }
};

 const handleVerMas = () => {
  setVerMas(true);
  if (selectedUser?.id) cargarDetalleExtra(selectedUser.id);
};

  const updateEstado = async (creditoId: string, nuevoEstado: string) => {
    const { error } = await supabase
      .from('creditos')
      .update({ estado: nuevoEstado })
      .eq('id', creditoId);

    if (!error) {
      alert(`Cliente marcado como ${nuevoEstado}`);
      fetchClientes();
      setSelectedUser(null);
    }
  };

  const eliminarCliente = async () => {
    if (!selectedUser) return;
    // Guardar referencia antes de cerrar el Dialog padre.
    // El Dialog de Radix tiene un focus trap que impide que el PIN modal
    // reciba foco en móvil; cerrándolo primero el teclado abre sin problema.
    pendingDeleteRef.current = selectedUser;
    setSelectedUser(null);
    setPinEliminarOpen(true);
  };

  const confirmarEliminarCliente = async () => {
    const user = pendingDeleteRef.current;
    if (!user) return;

    setEliminando(true);
    try {
      const creditoIds = (user.creditos || []).map((c: any) => c.id);
      if (creditoIds.length > 0) {
        const { error: errorPagos } = await supabase.from('pagos_diarios').delete().in('credito_id', creditoIds);
        if (errorPagos) throw errorPagos;
      }
      const { error: errorCreditos } = await supabase.from('creditos').delete().eq('cliente_id', user.id);
      if (errorCreditos) throw errorCreditos;
      const { error: errorCliente } = await supabase.from('clientes').delete().eq('id', user.id);
      if (errorCliente) throw errorCliente;

      alert('Cliente eliminado correctamente.');
      pendingDeleteRef.current = null;
      fetchClientes();
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      alert('Ocurrió un error al eliminar el cliente.');
    } finally {
      setEliminando(false);
    }
  };

  const imprimirEstado = async () => {
  if (!selectedUser) return;

  // Convertir logo a data URL para que se muestre en la ventana de impresión (blob URL)
  let logoDataUrl = '';
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    // Logo no se mostrará si falla el fetch
  }
  const fechaActual = new Date();
  const fechaProximoPago = new Date(fechaActual);
  
  // Calcular próximo día hábil (lunes a viernes)
  do {
    fechaProximoPago.setDate(fechaProximoPago.getDate() + 1);
  } while (fechaProximoPago.getDay() === 0 || fechaProximoPago.getDay() === 6);

  const fechaHoy = fechaActual.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const fechaPago = fechaProximoPago.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const diaPago = fechaProximoPago.toLocaleDateString('es-MX', { weekday: 'long' });

  const contenido = `
    <html>
      <head>
        <title>Estado de Cuenta - ${selectedUser?.profiles?.nombre_completo}</title>
        <style>
          * { margin: 0; padding: 0; }
          body { 
            font-family: 'Arial', sans-serif; 
            padding: 40px; 
            color: #333;
            background-image: 
              repeating-linear-gradient(45deg, transparent, transparent 200px, rgba(220,38,38,0.03) 200px, rgba(220,38,38,0.03) 400px);
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            opacity: 0.05;
            color: #dc2626;
            font-weight: bold;
            pointer-events: none;
            z-index: 0;
          }
          .container {
            position: relative;
            z-index: 1;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border-bottom: 3px solid #dc2626; 
            padding-bottom: 20px; 
            margin-bottom: 30px;
          }
          .logo { width: 140px; height: auto; }
          .header-text h1 { 
            color: #dc2626; 
            margin: 0; 
            font-size: 32px;
          }
          .fecha { 
            font-style: italic; 
            color: #666; 
            margin-top: 5px;
            font-size: 12px;
          }
          .section {
            margin-bottom: 25px;
            border-left: 4px solid #dc2626;
            padding-left: 15px;
          }
          .section-title {
            font-weight: bold;
            color: #dc2626;
            font-size: 14px;
            text-transform: uppercase;
            margin-bottom: 10px;
            letter-spacing: 1px;
          }
          .info-row { 
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px; 
            font-size: 15px;
          }
          .info-label {
            font-weight: bold;
            color: #333;
            min-width: 200px;
          }
          .info-value {
            text-align: right;
            color: #666;
            flex: 1;
          }
          .highlight {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
          }
          .amount {
            font-size: 24px;
            font-weight: bold;
            color: #dc2626;
          }
          .footer {
            border-top: 1px solid #ddd;
            margin-top: 40px;
            padding-top: 20px;
            font-size: 11px;
            color: #999;
            text-align: center;
          }
          .btn-back {
            display: none;
            position: fixed;
            top: 12px;
            left: 12px;
            background: #1f2937;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            z-index: 999;
          }
          .btn-back-mobile {
            display: none;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #1f2937;
            color: white;
            border: none;
            padding: 18px 24px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            z-index: 999;
            border-top: 1px solid #374151;
          }
          @media screen and (min-width: 641px) {
            .btn-back { display: block; }
          }
          @media screen and (max-width: 640px) {
            .btn-back-mobile { display: block; }
            body { padding-bottom: 80px; }
          }
          @media print {
            .btn-back, .btn-back-mobile { display: none !important; }
          }
        </style>
      </head>
      <body>
        <button class="btn-back" onclick="window.close()">← Cerrar</button>
        <button class="btn-back-mobile" onclick="window.close()">← Regresar</button>
        <div class="watermark">CrediCabs</div>

        <div class="container">
          <div class="header">
            <div class="header-text">
              <h1>Estado de Cuenta</h1>
              <p class="fecha">Impreso el: ${fechaHoy}</p>
            </div>
            ${logoDataUrl ? `<img src="${logoDataUrl}" alt="CrediCabs Logo" class="logo" />` : '<div style="width:140px"></div>'}
          </div>

          <div class="section">
            <div class="section-title">📋 Información del Cliente</div>
            <div class="info-row">
              <span class="info-label">Cliente:</span>
              <span class="info-value">${selectedUser?.profiles?.nombre_completo}</span>
            </div>
            <div class="info-row">
              <span class="info-label">ID Cliente:</span>
              <span class="info-value">${selectedUser?.numero_cliente}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">💰 Información del Crédito</div>
            <div class="info-row">
              <span class="info-label">Crédito Total:</span>
              <span class="info-value">$${selectedUser?.credito?.monto_total?.toLocaleString('es-MX')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Pago Diario:</span>
              <span class="info-value">$${Math.round(selectedUser?.credito?.monto_diario || 0).toLocaleString('es-MX')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Estado:</span>
              <span class="info-value">${(selectedUser?.credito?.estado || 'Activo').toUpperCase()}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">📅 Próximo Pago</div>
            <div class="highlight">
              <div class="info-row">
                <span class="info-label">Fecha de Pago:</span>
                <span class="info-value"><strong>${diaPago.toUpperCase()}, ${fechaPago}</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Monto a Pagar:</span>
                <span class="info-value amount">$${Math.round(selectedUser?.credito?.monto_diario || 0).toLocaleString('es-MX')}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Este documento es un comprobante de su estado de cuenta en CrediCabs.</p>
            <p>Para consultas, contacte a su cobrador asignado.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  
  const htmlCompleto = contenido + `
    <script>
      window.addEventListener('load', function() {
        setTimeout(function() { window.print(); }, 300);
      });
    </script>
  `;
  const blob = new Blob([htmlCompleto], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

  const filteredClientes = clientes.filter((cliente) => {
    const credito = cliente.creditos && cliente.creditos.length > 0 ? cliente.creditos[0] : null;
    const estadoActual = (credito?.estado || 'activo').toLowerCase();
    const nombre = (cliente.profiles?.nombre_completo || "").toLowerCase();
    const numero = (cliente.numero_cliente || "").toString();
    const term = (searchQuery || "").toLowerCase().trim();
    const filter = (statusFilter || 'todos').toLowerCase();
    const matchesStatus = filter === 'todos' || estadoActual === filter;
    const matchesSearch = !term || nombre.includes(term) || numero.includes(term);
    return matchesStatus && matchesSearch;
  });

  // Contenido del diálogo — responsive: scroll interno, header fijo, footer fijo
  const dialogContent = selectedUser ? (
    <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-2xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">

      {/* ── HEADER FIJO ── */}
      <div className="shrink-0 px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Expediente del Cliente</p>
          <DialogTitle className="text-white font-black text-lg leading-tight truncate mt-0.5">
            {selectedUser?.profiles?.nombre_completo}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-yellow-500 font-mono text-xs font-bold">#{selectedUser?.numero_cliente}</span>
            {(selectedUser?.creditos || []).filter((c: any) => c.estado !== 'completado').map((c: any) => (
              <Badge
                key={c.id}
                variant={c.estado === 'atrasado' ? 'destructive' : 'default'}
                className="text-[10px] px-1.5 py-0"
              >
                {c.estado || 'activo'}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENIDO SCROLLABLE ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* 1. CRÉDITOS — tarjetas por crédito con acciones de estado */}
        <section className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Créditos Activos</p>
          {(selectedUser?.creditos || []).filter((c: any) => c.estado !== 'completado').length === 0 && (
            <p className="text-gray-500 text-sm">Sin créditos activos.</p>
          )}
          {(selectedUser?.creditos || []).filter((c: any) => c.estado !== 'completado').map((c: any, i: number) => (
            <div key={c.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm">${c.monto_total?.toLocaleString('es-MX')}</p>
                  <p className="text-gray-400 text-[10px]">
                    Crédito {i + 1} · ${Math.round(c.monto_diario || 0).toLocaleString('es-MX')}/día · {c.semanas_autorizadas} pagos
                  </p>
                </div>
                <Badge variant={c.estado === 'atrasado' ? 'destructive' : 'default'} className="shrink-0 text-[10px]">
                  {c.estado || 'activo'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="destructive" className="text-xs h-8"
                  onClick={() => updateEstado(c.id, 'atrasado')}>
                  ⚠ Atrasado
                </Button>
                <Button size="sm" variant="secondary" className="text-xs h-8"
                  onClick={() => updateEstado(c.id, 'activo')}>
                  ✓ Activo
                </Button>
              </div>
            </div>
          ))}
        </section>

        {/* 2. INFO CLIENTE */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Información del Cliente</p>
            {!editando ? (
              <button onClick={() => setEditando(true)}
                className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">✏️ Editar</button>
            ) : (
              <button onClick={() => { setEditando(false); setEditForm({ nombre_completo: selectedUser?.profiles?.nombre_completo || '', telefono: selectedUser?.profiles?.telefono || '', direccion: selectedUser?.direccion || '' }); }}
                className="text-xs text-gray-500 hover:text-gray-300 font-medium">Cancelar</button>
            )}
          </div>

          {editando ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nombre completo</label>
                  <input type="text" value={editForm.nombre_completo}
                    onChange={e => setEditForm(f => ({ ...f, nombre_completo: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
                  <input type="tel" value={editForm.telefono}
                    onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Dirección</label>
                <input type="text" value={editForm.direccion}
                  onChange={e => setEditForm(f => ({ ...f, direccion: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
              </div>
              <Button onClick={guardarEdicion} disabled={guardandoEdicion}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold">
                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {selectedUser?.profiles?.telefono && (
                <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                  <p className="text-gray-500 text-[10px] mb-0.5">Teléfono</p>
                  <a href={`tel:${selectedUser.profiles.telefono}`} className="text-yellow-400 hover:underline font-medium">
                    {selectedUser.profiles.telefono}
                  </a>
                </div>
              )}
              {selectedUser?.profiles?.email && (
                <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                  <p className="text-gray-500 text-[10px] mb-0.5">Email</p>
                  <p className="text-white truncate">{selectedUser.profiles.email}</p>
                </div>
              )}
              {selectedUser?.direccion && (
                <div className="bg-gray-800/50 rounded-lg px-3 py-2 sm:col-span-2">
                  <p className="text-gray-500 text-[10px] mb-0.5">Dirección</p>
                  <p className="text-white">{selectedUser.direccion}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. COBRADOR */}
        <section className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Cobrador Asignado</p>
          <p className="text-xs text-gray-500">
            Actual: <span className="text-white font-medium">
              {cobradores.find(c => c.id === selectedUser?.cobrador_asignado_id)?.nombre_completo || 'Sin asignar'}
            </span>
          </p>
          <div className="flex gap-2">
            <select value={nuevoCobrador} onChange={e => setNuevoCobrador(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 min-w-0">
              <option value="">Selecciona cobrador...</option>
              {cobradores.map(c => <option key={c.id} value={c.id}>{c.nombre_completo}</option>)}
            </select>
            <Button onClick={reasignarCobrador}
              disabled={reasignando || !nuevoCobrador || nuevoCobrador === selectedUser?.cobrador_asignado_id}
              className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold shrink-0">
              {reasignando ? '...' : 'Guardar'}
            </Button>
          </div>
        </section>

        {/* 4. EDITAR CRÉDITO (primer crédito activo) */}
        {selectedUser?.credito && (
          <section className="space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Editar Crédito Principal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Monto total ($)</label>
                <input type="number" min={1} value={editCredito.monto_total}
                  onChange={e => setEditCredito(f => ({ ...f, monto_total: Number(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Esquema de pago</label>
                <select value={editCredito.num_pagos}
                  onChange={e => setEditCredito(f => ({ ...f, num_pagos: Number(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500">
                  <option value={28}>28 pagos (~6 sem)</option>
                  <option value={37}>37 pagos (~8 sem)</option>
                </select>
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg px-3 py-2 flex justify-between text-xs">
              <span className="text-gray-400">Pago diario estimado</span>
              <span className="text-white font-bold">
                ${editCredito.monto_total > 0 ? Math.round(editCredito.monto_total / editCredito.num_pagos).toLocaleString('es-MX') : '0'}
              </span>
            </div>
            <Button onClick={guardarCredito} disabled={guardandoCredito || editCredito.monto_total <= 0}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold">
              {guardandoCredito ? 'Actualizando...' : 'Actualizar Crédito'}
            </Button>
          </section>
        )}

        {/* 5. NUEVO CRÉDITO */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Nuevo Crédito</p>
            <button onClick={() => setShowNuevoCredito(!showNuevoCredito)}
              className={`text-xs font-bold ${showNuevoCredito ? 'text-gray-500' : 'text-green-500 hover:text-green-400'}`}>
              {showNuevoCredito ? 'Cancelar' : '+ Agregar crédito'}
            </button>
          </div>
          {showNuevoCredito && (
            <div className="space-y-2 bg-gray-800/30 border border-gray-700 rounded-xl p-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">Monto ($)</label>
                  <input type="number" min={1} value={nuevoCredito.monto_total || ''}
                    onChange={e => setNuevoCredito(f => ({ ...f, monto_total: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Pagos</label>
                  <select value={nuevoCredito.num_pagos}
                    onChange={e => setNuevoCredito(f => ({ ...f, num_pagos: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
                    <option value={28}>28 (~6 sem)</option>
                    <option value={37}>37 (~8 sem)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Interés (%)</label>
                  <input type="number" min={0} max={100} step={0.5} value={nuevoCredito.tasa || ''}
                    onChange={e => setNuevoCredito(f => ({ ...f, tasa: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
                </div>
              </div>
              {nuevoCredito.monto_total > 0 && (
                <div className="bg-gray-800/50 rounded-lg px-3 py-2 flex justify-between text-xs">
                  <span className="text-gray-400">Pago diario estimado</span>
                  <span className="text-green-400 font-bold">
                    ${Math.round((nuevoCredito.monto_total * (1 + nuevoCredito.tasa / 100)) / nuevoCredito.num_pagos).toLocaleString('es-MX')}
                  </span>
                </div>
              )}
              <Button onClick={agregarCredito} disabled={agregandoCredito || nuevoCredito.monto_total <= 0}
                className="w-full bg-green-700 hover:bg-green-600 text-white font-bold">
                {agregandoCredito ? 'Creando...' : 'Crear Crédito'}
              </Button>
            </div>
          )}
        </section>

        {/* 6. DOCUMENTOS (colapsable) */}
        <section className="space-y-2">
          <button onClick={verMas ? () => { setVerMas(false); setDetalleExtra(null); } : handleVerMas}
            className="w-full flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-semibold hover:text-gray-300 transition-colors">
            <span>Documentos e Info Adicional</span>
            <span>{verMas ? '▲ Ocultar' : '▼ Ver'}</span>
          </button>

          {verMas && (
            <div className="space-y-3 pt-1">
              {cargandoDetalle ? (
                <div className="text-center py-6">
                  <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : (
                <>
                  {selectedUser?.profiles?.foto_url && (
                    <div className="flex items-center gap-3">
                      <img src={selectedUser.profiles.foto_url} alt="Foto"
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-700 shrink-0" />
                      <div className="text-sm text-gray-400">Foto del cliente</div>
                    </div>
                  )}

                  {(detalleExtra?.ocupacion || detalleExtra?.ingreso_mensual) && (
                    <div className="grid grid-cols-2 gap-2">
                      {detalleExtra?.ocupacion && (
                        <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                          <p className="text-gray-500 text-[10px] mb-0.5">Ocupación</p>
                          <p className="text-white text-sm">{detalleExtra.ocupacion}</p>
                        </div>
                      )}
                      {detalleExtra?.ingreso_mensual && (
                        <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                          <p className="text-gray-500 text-[10px] mb-0.5">Ingreso mensual</p>
                          <p className="text-white text-sm">${Number(detalleExtra.ingreso_mensual).toLocaleString('es-MX')}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(detalleExtra?.ine_url || detalleExtra?.comprobante_url) ? (
                    <div className="grid grid-cols-2 gap-3">
                      {detalleExtra?.ine_url && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-500 text-center uppercase tracking-wide">INE</p>
                          <button
                            type="button"
                            onClick={() => setLightbox({ src: detalleExtra.ine_url, alt: 'Foto INE' })}
                            className="w-full block"
                          >
                            <img src={detalleExtra.ine_url} alt="INE"
                              className="w-full h-32 object-cover rounded-xl border border-gray-700 hover:border-yellow-500 active:opacity-70 transition-all cursor-pointer" />
                          </button>
                        </div>
                      )}
                      {detalleExtra?.comprobante_url && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-500 text-center uppercase tracking-wide">Comprobante</p>
                          <button
                            type="button"
                            onClick={() => setLightbox({ src: detalleExtra.comprobante_url, alt: 'Comprobante de Domicilio' })}
                            className="w-full block"
                          >
                            <img src={detalleExtra.comprobante_url} alt="Comprobante"
                              className="w-full h-32 object-cover rounded-xl border border-gray-700 hover:border-yellow-500 active:opacity-70 transition-all cursor-pointer" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-gray-600 text-xs py-2">Sin documentos adjuntos.</p>
                  )}
                </>
              )}
            </div>
          )}
        </section>

      </div>

      {/* ── FOOTER FIJO ── */}
      <div className="shrink-0 px-5 py-3 border-t border-gray-800 grid grid-cols-2 gap-2">
        <Button className="bg-red-700 hover:bg-red-600 text-white font-bold text-xs h-9" onClick={imprimirEstado}>
          🖨 Imprimir Estado
        </Button>
        <Button variant="destructive" className="font-bold text-xs h-9" onClick={eliminarCliente} disabled={eliminando}>
          {eliminando ? 'Eliminando...' : '🗑 Eliminar Cliente'}
        </Button>
      </div>

    </DialogContent>
  ) : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden w-full">

      {/* Lightbox para fotos de documentos */}
      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}

      {/* Dialog único compartido por móvil y escritorio */}
      <Dialog
        open={!!selectedUser}
        onOpenChange={(open) => {
          if (!open) { setSelectedUser(null); setVerMas(false); setDetalleExtra(null); setEditando(false); setShowNuevoCredito(false); }
        }}
      >
        {dialogContent}
      </Dialog>

      {/* PIN para eliminar cliente */}
      <AdminPinModal
        open={pinEliminarOpen}
        titulo="Eliminar Cliente"
        descripcion={`¿Seguro que deseas eliminar a "${selectedUser?.profiles?.nombre_completo}"? Esta acción no se puede deshacer.`}
        onConfirm={() => { setPinEliminarOpen(false); confirmarEliminarCliente(); }}
        onCancel={() => setPinEliminarOpen(false)}
      />

      {/* ── MÓVIL: lista de tarjetas ── */}
      <div className="md:hidden divide-y divide-gray-800 max-h-[70vh] overflow-y-auto">
        {filteredClientes.length === 0 ? (
          <p className="text-center py-10 text-gray-500 text-sm">No se encontraron resultados</p>
        ) : filteredClientes.map((cliente) => {
          const credito = cliente.creditos?.[0] || null;
          const estado = credito?.estado || 'activo';
          const cobrador = cobradores.find(c => c.id === cliente.cobrador_asignado_id)?.nombre_completo;
          return (
            <div key={cliente.id} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-yellow-500 font-mono text-xs font-bold">{cliente.numero_cliente}</span>
                  <Badge variant={estado === 'activo' ? 'default' : estado === 'completado' ? 'secondary' : 'destructive'} className="text-[10px] px-1.5 py-0">
                    {estado}
                  </Badge>
                </div>
                <p className="text-white font-semibold text-sm truncate">{cliente.profiles?.nombre_completo || 'Sin nombre'}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {credito
                    ? `$${credito.monto_total?.toLocaleString('es-MX')} · $${Math.round(credito.monto_diario || 0).toLocaleString('es-MX')}/sem`
                    : '---'}
                </p>
                {cobrador && <p className="text-gray-500 text-xs truncate">{cobrador}</p>}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => setSelectedUser({ ...cliente, credito })}
              >
                Ver
              </Button>
            </div>
          );
        })}
      </div>

      {/* ── ESCRITORIO: tabla ── */}
      <div className="hidden md:block max-h-[600px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-gray-950 z-10 shadow-sm">
            <TableRow className="hover:bg-transparent border-gray-800">
              <TableHead className="w-[50px]"><Checkbox /></TableHead>
              <TableHead>No. Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Crédito Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cobrador</TableHead>
              <TableHead className="text-right">Cuota Diaria</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClientes.length > 0 ? (
              filteredClientes.map((cliente) => {
                const credito = cliente.creditos?.[0] || null;
                const estado = credito?.estado || 'activo';
                return (
                  <TableRow key={cliente.numero_cliente}>
                    <TableCell><Checkbox /></TableCell>
                    <TableCell className="font-bold text-yellow-500">{cliente.numero_cliente}</TableCell>
                    <TableCell className="text-white">{cliente.profiles?.nombre_completo || 'Sin nombre'}</TableCell>
                    <TableCell className="text-gray-300">{credito ? `$${credito.monto_total?.toLocaleString('es-MX')}` : '---'}</TableCell>
                    <TableCell>
                      <Badge variant={estado === 'activo' ? 'default' : estado === 'completado' ? 'secondary' : 'destructive'}>
                        {estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300 text-sm">
                      {cobradores.find(c => c.id === cliente.cobrador_asignado_id)?.nombre_completo || '—'}
                    </TableCell>
                    <TableCell className="text-right text-white font-medium">
                      {credito ? `$${Math.round(credito.monto_diario || 0).toLocaleString('es-MX')}` : '---'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline" onClick={() => setSelectedUser({ ...cliente, credito })}>
                        Ver Detalles
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-gray-500">No se encontraron resultados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}