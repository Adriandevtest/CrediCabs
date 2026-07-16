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

    const { pin_actual, pin_nuevo } = await req.json();
    if (!pin_actual || !pin_nuevo) {
      return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pin_nuevo)) {
      return NextResponse.json({ ok: false, error: 'El PIN debe ser 4 dígitos' }, { status: 400 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar PIN actual
    const { data } = await sb
      .from('configuracion')
      .select('valor')
      .eq('clave', 'pin_admin')
      .single();

    const pinActual = data?.valor || DEFAULT_PIN;
    if (pin_actual !== pinActual) {
      return NextResponse.json({ ok: false, error: 'PIN actual incorrecto' }, { status: 403 });
    }

    // Guardar PIN nuevo
    await sb
      .from('configuracion')
      .upsert({ clave: 'pin_admin', valor: pin_nuevo });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Error del servidor' }, { status: 500 });
  }
}
