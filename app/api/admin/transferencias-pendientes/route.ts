import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Transferencias pendientes sin joins para evitar errores de FK en PostgREST
    const { data: transferencias, error } = await sb
      .from('transferencias')
      .select('*')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!transferencias || transferencias.length === 0) {
      return NextResponse.json({ transferencias: [] });
    }

    // 2. Nombres de clientes
    const clienteIds = [...new Set(transferencias.map((t: any) => t.cliente_id))];
    const { data: perfiles } = await sb
      .from('profiles')
      .select('id, nombre_completo')
      .in('id', clienteIds);
    const perfilMap = new Map((perfiles || []).map((p: any) => [p.id, p.nombre_completo]));

    // 3. Cuota diaria de cada crédito
    const creditoIds = [...new Set(transferencias.map((t: any) => t.credito_id).filter(Boolean))];
    let cuotaMap = new Map<string, number>();
    if (creditoIds.length > 0) {
      const { data: creditos } = await sb
        .from('creditos')
        .select('id, monto_diario')
        .in('id', creditoIds);
      cuotaMap = new Map((creditos || []).map((c: any) => [c.id, c.monto_diario]));
    }

    // 4. Pagos vencidos por crédito para calcular mora
    const today = new Date().toISOString().split('T')[0];
    const MORA_POR_DIA = 50;
    const moraMap = new Map<string, { dias: number; mora: number }>();
    if (creditoIds.length > 0) {
      const { data: pagosVencidos } = await sb
        .from('pagos_diarios')
        .select('credito_id')
        .in('credito_id', creditoIds)
        .eq('pagado', false)
        .lt('fecha_esperada', today);

      for (const p of pagosVencidos || []) {
        const prev = moraMap.get(p.credito_id) ?? { dias: 0, mora: 0 };
        moraMap.set(p.credito_id, { dias: prev.dias + 1, mora: prev.mora + MORA_POR_DIA });
      }
    }

    const result = transferencias.map((t: any) => {
      const mora = moraMap.get(t.credito_id) ?? { dias: 0, mora: 0 };
      return {
        ...t,
        cliente_nombre: perfilMap.get(t.cliente_id) || 'Cliente',
        _cuota: cuotaMap.get(t.credito_id) || 0,
        _moraReal: mora.mora,
        _diasAtraso: mora.dias,
      };
    });

    return NextResponse.json({ transferencias: result });
  } catch (error: any) {
    console.error('Error en transferencias-pendientes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
