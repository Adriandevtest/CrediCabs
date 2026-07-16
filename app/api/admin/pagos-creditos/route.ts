import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const ids = req.nextUrl.searchParams.get('ids');
    if (!ids) return NextResponse.json({ pagos: [] });

    const creditoIds = ids.split(',').filter(Boolean);
    if (creditoIds.length === 0) return NextResponse.json({ pagos: [] });

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: pagos, error } = await sb
      .from('pagos_diarios')
      .select('credito_id, fecha_esperada, pagado, mora')
      .in('credito_id', creditoIds)
      .order('fecha_esperada', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ pagos: pagos || [] });
  } catch (error: any) {
    console.error('Error en pagos-creditos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
