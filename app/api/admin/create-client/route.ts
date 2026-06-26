import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const {
      nombre_completo,
      email,
      telefono,
      direccion,
      monto_total,
      semanas_autorizadas,
      tasa_interes_porcentaje,
      cobrador_asignado_id
    } = await request.json();

    if (!nombre_completo || !monto_total || !semanas_autorizadas || !cobrador_asignado_id) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }
    if (semanas_autorizadas !== 28 && semanas_autorizadas !== 37) {
      return NextResponse.json({ error: 'El esquema debe ser 28 o 37 pagos.' }, { status: 400 });
    }
    if (typeof monto_total !== 'number' || monto_total <= 0) {
      return NextResponse.json({ error: 'El monto debe ser un número positivo.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Crear usuario en Auth sin iniciar sesión
    const emailAutomatico = email || `cliente_${Date.now()}@credicabs.com`;
    const passwordAleatorio = 'C' + Math.random().toString(36).slice(-6);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailAutomatico,
      password: passwordAleatorio,
      email_confirm: true,
      user_metadata: {
        nombre_completo,
        rol: 'cliente'
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('No se pudo crear el usuario en Auth.');

    const clienteId = authData.user.id;

    // 2. Crear perfil en profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: clienteId,
        nombre_completo,
        email: emailAutomatico,
        telefono: telefono || null,
        rol: 'cliente'
      });

    if (profileError) throw profileError;

    // 3. Crear registro en clientes
    const { error: clienteError } = await supabaseAdmin
      .from('clientes')
      .insert({
        id: clienteId,
        numero_cliente: `CLI-${Date.now().toString().slice(-4)}`,
        cobrador_asignado_id,
        direccion: direccion || null
      });

    if (clienteError) throw clienteError;

    // 4. Calcular interés y crear crédito (esquema diario: 28 o 37 pagos de Lunes a Viernes)
    const tasaPorcentaje = parseFloat(tasa_interes_porcentaje?.toString() || '0');
    const interesTotal = monto_total * (tasaPorcentaje / 100);
    const cuotaDiaria = Math.ceil((monto_total + interesTotal) / semanas_autorizadas);

    const { data: creditoData, error: creditoError } = await supabaseAdmin
      .from('creditos')
      .insert({
        cliente_id: clienteId,
        monto_total,
        semanas_autorizadas,
        monto_diario: cuotaDiaria,
        tasa_interes_porcentaje: tasaPorcentaje,
        interes_total: interesTotal,
        estado: 'activo',
        fecha_inicio: new Date().toLocaleDateString('en-CA')
      })
      .select()
      .single();

    if (creditoError) throw creditoError;

    // 5. Generar calendario diario (un pago por día, solo Lunes-Viernes)
    let fechaActual = new Date();

    // Si hoy es fin de semana, avanzar al lunes
    while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    const pagos = [];
    for (let i = 0; i < semanas_autorizadas; i++) {
      pagos.push({
        credito_id: creditoData.id,
        numero_dia: i + 1,
        fecha_esperada: new Date(fechaActual).toLocaleDateString('en-CA'),
        pagado: false
      });
      // Avanzar al siguiente día hábil
      fechaActual.setDate(fechaActual.getDate() + 1);
      while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
    }

    const { error: pagosError } = await supabaseAdmin
      .from('pagos_diarios')
      .insert(pagos);

    if (pagosError) throw pagosError;

    return NextResponse.json({
      success: true,
      clienteId,
      creditoId: creditoData.id,
      message: `Cliente ${nombre_completo} creado exitosamente con crédito`
    });

  } catch (error: any) {
    console.error("Error en create-client API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
