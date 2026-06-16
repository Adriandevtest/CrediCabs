import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { id, clearAll, filterRol, filterId } = await request.json();

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (clearAll) {
      let q = db.from('notificaciones').delete();
      if (filterRol) q = (q as any).eq('destinatario_rol', filterRol);
      if (filterId)  q = (q as any).eq('destinatario_id', filterId);
      await q;
    } else if (id) {
      await db.from('notificaciones').delete().eq('id', id);
    } else {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
