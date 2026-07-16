import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Ruta de migración de una sola vez:
// Actualiza email + contraseña de todos los clientes existentes al formato
// CLI-XXXX@credicabs.com / CLI-XXXX
// Protegida con ?secret=MIGRATION_SECRET (definir en .env.local)

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Obtener todos los clientes con su numero_cliente e id (= auth user id)
  const { data: clientes, error } = await supabaseAdmin
    .from('clientes')
    .select('id, numero_cliente');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!clientes?.length) return NextResponse.json({ message: 'Sin clientes', updated: 0 });

  const resultados: { numero_cliente: string; ok: boolean; error?: string }[] = [];

  for (const c of clientes) {
    const emailNuevo = `${c.numero_cliente}@credicabs.com`;
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(c.id, {
      email: emailNuevo,
      password: c.numero_cliente,
      email_confirm: true,
    });

    if (!updateError) {
      // Sincronizar email también en profiles
      await supabaseAdmin
        .from('profiles')
        .update({ email: emailNuevo })
        .eq('id', c.id);
    }

    resultados.push({
      numero_cliente: c.numero_cliente,
      ok: !updateError,
      error: updateError?.message,
    });
  }

  const exitosos = resultados.filter(r => r.ok).length;
  const fallidos = resultados.filter(r => !r.ok);

  return NextResponse.json({
    message: `Migración completada: ${exitosos}/${clientes.length} clientes actualizados`,
    fallidos: fallidos.length ? fallidos : undefined,
  });
}
