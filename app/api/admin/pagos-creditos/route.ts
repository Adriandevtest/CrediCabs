import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const ids = req.nextUrl.searchParams.get('ids');
    if (!ids) return NextResponse.json({ pagos: [] });

    const creditoIds = ids.split(',').filter(Boolean);
    if (creditoIds.length === 0) return NextResponse.json({ pagos: [] });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pnesuibfgtescgudkerf.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZXN1aWJmZ3Rlc2NndWRrZXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTU4MjMyMSwiZXhwIjoyMDk1MTU4MzIxfQ.tmiI8NHQiGDnZkjRgz_tXwjY3kVjiP7g2JmqMp38BhM';
    const sb = createClient(supabaseUrl, serviceKey);

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
