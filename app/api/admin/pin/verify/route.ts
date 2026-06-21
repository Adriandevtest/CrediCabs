import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://pnesuibfgtescgudkerf.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZXN1aWJmZ3Rlc2NndWRrZXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTU4MjMyMSwiZXhwIjoyMDk1MTU4MzIxfQ.tmiI8NHQiGDnZkjRgz_tXwjY3kVjiP7g2JmqMp38BhM';

const DEFAULT_PIN = '2209';

export async function POST(req: Request) {
  try {
    const { pin } = await req.json();
    if (!pin) return NextResponse.json({ ok: false, error: 'PIN requerido' }, { status: 400 });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
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
