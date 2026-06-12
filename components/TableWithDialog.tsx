"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "./ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { supabase } from "../lib/supabase";

export default function TableWithDialog({ searchQuery, statusFilter = 'todos' }: { searchQuery: string, statusFilter: string }) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select(`
        id,
        numero_cliente, 
        profiles ( nombre_completo ), 
        creditos ( id, monto_total, monto_diario, estado, semanas_autorizadas )
      `)
      .order('numero_cliente', { ascending: false });
    
    if (data) setClientes(data);
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

  // ✅ NUEVA FUNCIÓN: Eliminar cliente en cascada
  const eliminarCliente = async () => {
    if (!selectedUser) return;

    const confirmar = window.confirm(
      `¿Estás seguro de eliminar a "${selectedUser.profiles?.nombre_completo}"? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setEliminando(true);
    try {
      const creditoIds = (selectedUser.creditos || []).map((c: any) => c.id);

      // 1. Eliminar pagos_diarios relacionados
      if (creditoIds.length > 0) {
        const { error: errorPagos } = await supabase
          .from('pagos_diarios')
          .delete()
          .in('credito_id', creditoIds);
        if (errorPagos) throw errorPagos;
      }

      // 2. Eliminar créditos del cliente
      const { error: errorCreditos } = await supabase
        .from('creditos')
        .delete()
        .eq('cliente_id', selectedUser.id);
      if (errorCreditos) throw errorCreditos;

      // 3. Eliminar el cliente
      const { error: errorCliente } = await supabase
        .from('clientes')
        .delete()
        .eq('id', selectedUser.id);
      if (errorCliente) throw errorCliente;

      alert('Cliente eliminado correctamente.');
      setSelectedUser(null);
      fetchClientes();
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      alert('Ocurrió un error al eliminar el cliente.');
    } finally {
      setEliminando(false);
    }
  };

  const imprimirEstado = () => {
    if (!selectedUser) return;
    
    const fechaActual = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const contenido = `
      <html>
        <head>
          <title>Estado de Cuenta - ${selectedUser?.profiles?.nombre_completo}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #dc2626; padding-bottom: 20px; margin-bottom: 20px; }
            .logo { width: 120px; }
            h1 { color: #dc2626; margin: 0; }
            .info { margin-bottom: 15px; font-size: 16px; }
            .fecha { font-style: italic; color: #666; margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Estado de Cuenta</h1>
              <p class="fecha">Impreso el: ${fechaActual}</p>
            </div>
            <img src="/logo.png" alt="CrediCab's Logo" class="logo" />
          </div>
          <div class="info"><strong>Cliente:</strong> ${selectedUser?.profiles?.nombre_completo}</div>
          <div class="info"><strong>ID Cliente:</strong> ${selectedUser?.numero_cliente}</div>
          <div class="info"><strong>Crédito Total:</strong> $${selectedUser?.credito?.monto_total?.toLocaleString('es-MX')}</div>
          <div class="info"><strong>Pago Diario:</strong> $${Math.round(selectedUser?.credito?.monto_diario || 0).toLocaleString('es-MX')}</div>
          <div class="info"><strong>Estado:</strong> ${selectedUser?.credito?.estado?.toUpperCase()}</div>
        </body>
      </html>
    `;
    const ventanaImpresion = window.open('', '_blank');
    ventanaImpresion?.document.write(contenido);
    ventanaImpresion?.document.close();
    ventanaImpresion?.print();
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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden w-full">
      <div className="max-h-[600px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-gray-950 z-10 shadow-sm">
            <TableRow className="hover:bg-transparent border-gray-800">
              <TableHead className="w-[50px]"><Checkbox /></TableHead>
              <TableHead>No. Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Crédito Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Cuota Diaria</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredClientes.length > 0 ? (
              filteredClientes.map((cliente) => {
                const credito = cliente.creditos && cliente.creditos.length > 0 ? cliente.creditos[0] : null;
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
                    <TableCell className="text-right text-white font-medium">{credito ? `$${Math.round(credito.monto_diario || 0).toLocaleString('es-MX')}` : '---'}</TableCell>
                    <TableCell className="text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => setSelectedUser({ ...cliente, credito })}>
                            Ver Detalles
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Expediente del Cliente</DialogTitle>
                            <DialogDescription>
                              Acciones para <span className="font-medium text-white">{selectedUser?.profiles?.nombre_completo}</span>
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4 mt-4">
                            {selectedUser?.credito ? (
                              <div className="grid grid-cols-2 gap-2">
                                <Button 
                                  variant={selectedUser.credito.estado === 'atrasado' ? "default" : "destructive"}
                                  onClick={() => updateEstado(selectedUser.credito.id, 'atrasado')}
                                >
                                  Marcar Atrasado
                                </Button>
                                <Button 
                                  variant={selectedUser.credito.estado === 'activo' ? "default" : "secondary"}
                                  onClick={() => updateEstado(selectedUser.credito.id, 'activo')}
                                >
                                  Marcar Activo
                                </Button>
                              </div>
                            ) : <p className="text-red-500 text-sm">Sin crédito activo.</p>}
                            
                            <div className="text-sm text-gray-300 border-t pt-4">
                              <p><strong>ID Cliente:</strong> {selectedUser?.numero_cliente}</p>
                              <p><strong>Pago Diario:</strong> ${Math.round(selectedUser?.credito?.monto_diario || 0)}</p>
                            </div>

                            <div className="mt-4 flex flex-col gap-2">
                              <Button className="w-full bg-red-600 hover:bg-red-700" onClick={imprimirEstado}>
                                Imprimir Estado
                              </Button>

                              {/* ✅ BOTÓN ELIMINAR */}
                              <Button
                                className="w-full"
                                variant="destructive"
                                onClick={eliminarCliente}
                                disabled={eliminando}
                              >
                                {eliminando ? 'Eliminando...' : '🗑 Eliminar Cliente'}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-gray-500">No se encontraron resultados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}