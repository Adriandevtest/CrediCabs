import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';


const DEFAULT_PIN = '2209';

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { pin } = await req.json();
    if (!pin) return NextResponse.json({ ok: false, error: 'PIN requerido' }, { status: 400 });

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await sb
      .from('configuracion')
      .select('valor')
      .eq('clave', 'pin_admin')
      .single();

    const pinCorrecto = data?.valor || DEFAULT_PIN;
    const ok = pin === pinCorrecto;
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false, error: 'Error del servidor' }, { status: 500 });
  }
}
