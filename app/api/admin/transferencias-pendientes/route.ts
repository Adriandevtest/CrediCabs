import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Usa service role para leer transferencias sin depender de RLS del cliente JWT.
// El cliente (panel-cliente) no tiene sesión Supabase auth, por lo que RLS
// en la tabla transferencias bloquea la lectura desde el cliente del admin.
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pnesuibfgtescgudkerf.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZXN1aWJmZ3Rlc2NndWRrZXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTU4MjMyMSwiZXhwIjoyMDk1MTU4MzIxfQ.tmiI8NHQiGDnZkjRgz_tXwjY3kVjiP7g2JmqMp38BhM';
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: transferencias, error } = await sb
      .from('transferencias')
      .select('*, creditos(monto_diario, pagos_diarios(fecha_esperada, pagado))')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!transferencias || transferencias.length === 0) {
      return NextResponse.json({ transferencias: [] });
    }

    // Enriquecer con nombre del cliente (perfil)
    const clienteIds = [...new Set(transferencias.map((t: any) => t.cliente_id))];
    const { data: perfiles } = await sb
      .from('profiles')
      .select('id, nombre_completo')
      .in('id', clienteIds);

    const perfilMap = new Map((perfiles || []).map((p: any) => [p.id, p]));

    const today = new Date().toISOString().split('T')[0];
    const MORA_POR_DIA = 50;

    const result = transferencias.map((t: any) => {
      const pagos: any[] = t.creditos?.pagos_diarios || [];
      const diasAtrasados = pagos.filter(
        (p: any) => p.fecha_esperada < today && !p.pagado
      ).length;
      return {
        ...t,
        cliente_nombre: perfilMap.get(t.cliente_id)?.nombre_completo || 'Cliente',
        _moraReal: diasAtrasados * MORA_POR_DIA,
        _diasAtraso: diasAtrasados,
      };
    });

    return NextResponse.json({ transferencias: result });
  } catch (error: any) {
    console.error('Error en transferencias-pendientes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
