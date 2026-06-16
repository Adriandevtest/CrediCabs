import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token, userId, clienteId } = await request.json();

    if (!token || (!userId && !clienteId)) {
      return NextResponse.json({ error: 'token y userId o clienteId son requeridos' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabaseAdmin
      .from('push_tokens')
      .upsert(
        { token, user_id: userId ?? null, cliente_id: clienteId ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'token' }
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[push] register-token error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
