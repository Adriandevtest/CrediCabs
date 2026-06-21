import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://pnesuibfgtescgudkerf.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZXN1aWJmZ3Rlc2NndWRrZXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTU4MjMyMSwiZXhwIjoyMDk1MTU4MzIxfQ.tmiI8NHQiGDnZkjRgz_tXwjY3kVjiP7g2JmqMp38BhM';

const DEFAULT_PIN = '2209';

export async function POST(req: Request) {
  try {
    const { pin_actual, pin_nuevo } = await req.json();
    if (!pin_actual || !pin_nuevo) {
      return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pin_nuevo)) {
      return NextResponse.json({ ok: false, error: 'El PIN debe ser 4 dígitos' }, { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

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
