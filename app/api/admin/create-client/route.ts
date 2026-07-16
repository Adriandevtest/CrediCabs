import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const {
      nombre_completo,
      email,
      telefono,
      direccion,
      monto_total,
      tipo_esquema,
      semanas_autorizadas,
      tasa_interes_porcentaje,
      cobrador_asignado_id,
      solicitud_id,
      dias_ya_pagados
    } = await request.json();

    if (!nombre_completo || !monto_total || !semanas_autorizadas || !cobrador_asignado_id) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    const esquema: string = tipo_esquema || 'diario';
    const numPagos: number = Number(semanas_autorizadas);

    if (!['diario', 'semanal', 'quincenal'].includes(esquema)) {
      return NextResponse.json({ error: 'Tipo de esquema no válido.' }, { status: 400 });
    }
    if (esquema === 'diario' && numPagos !== 28 && numPagos !== 37) {
      return NextResponse.json({ error: 'El esquema diario debe ser 28 o 37 pagos.' }, { status: 400 });
    }
    if (esquema === 'semanal' && numPagos !== 6 && numPagos !== 7) {
      return NextResponse.json({ error: 'El esquema semanal debe ser 6 o 7 pagos.' }, { status: 400 });
    }
    if (esquema === 'quincenal' && (numPagos < 1 || numPagos > 24)) {
      return NextResponse.json({ error: 'El número de quincenas debe ser entre 1 y 24.' }, { status: 400 });
    }
    if (typeof monto_total !== 'number' || monto_total <= 0) {
      return NextResponse.json({ error: 'El monto debe ser un número positivo.' }, { status: 400 });
    }

    // Cliente Existente: días ya cubiertos en papel antes de entrar a la app.
    // Se marcan pagado=true + pre_existente=true para que el calendario/progreso
    // del cliente sea correcto sin inflar Capital Actual (ver sql/pre_existente.sql).
    const diasYaPagados = Math.max(0, Math.min(numPagos, Math.floor(Number(dias_ya_pagados) || 0)));

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Generar número de cliente (se usa como email y contraseña)
    const numeroCliente = `CLI-${Date.now().toString().slice(-4)}`;
    const emailCliente = `${numeroCliente}@credicabs.com`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailCliente,
      password: numeroCliente,
      email_confirm: true,
      user_metadata: { nombre_completo, rol: 'cliente' }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('No se pudo crear el usuario en Auth.');

    const clienteId = authData.user.id;

    // 2. Crear perfil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: clienteId,
        nombre_completo,
        email: emailCliente,
        telefono: telefono || null,
        rol: 'cliente'
      });

    if (profileError) throw profileError;

    // 3. Crear registro en clientes
    const { error: clienteError } = await supabaseAdmin
      .from('clientes')
      .insert({
        id: clienteId,
        numero_cliente: numeroCliente,
        cobrador_asignado_id,
        direccion: direccion || null
      });

    if (clienteError) throw clienteError;

    // 3b. Vincular la solicitud de origen (si vino de un prospecto aprobado
    // en bandeja) para que el expediente del cliente pueda mostrar el INE y
    // comprobante capturados durante la solicitud. No es fatal si falla.
    if (solicitud_id) {
      await supabaseAdmin
        .from('solicitudes')
        .update({ cliente_id: clienteId })
        .eq('id', solicitud_id);
    }

    // 4. Calcular interés y cuota (misma fórmula para todos los esquemas)
    const tasaPorcentaje = parseFloat(tasa_interes_porcentaje?.toString() || '0');
    const interesTotal = monto_total * (tasaPorcentaje / 100);
    const cuota = Math.ceil((monto_total + interesTotal) / numPagos);

    const { data: creditoData, error: creditoError } = await supabaseAdmin
      .from('creditos')
      .insert({
        cliente_id: clienteId,
        monto_total,
        semanas_autorizadas: numPagos,
        monto_diario: cuota,
        tasa_interes_porcentaje: tasaPorcentaje,
        interes_total: interesTotal,
        tipo_esquema: esquema,
        estado: 'activo',
        fecha_inicio: new Date().toLocaleDateString('en-CA')
      })
      .select()
      .single();

    if (creditoError) throw creditoError;

    // 5. Generar calendario de pagos según esquema
    const pagos: { credito_id: string; numero_dia: number; fecha_esperada: string; pagado: boolean; pre_existente: boolean }[] = [];
    let fechaActual = new Date();

    if (esquema === 'diario') {
      // Lunes a Viernes, saltar fines de semana
      while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
      for (let i = 0; i < numPagos; i++) {
        pagos.push({
          credito_id: creditoData.id,
          numero_dia: i + 1,
          fecha_esperada: new Date(fechaActual).toLocaleDateString('en-CA'),
          pagado: false,
          pre_existente: false,
        });
        fechaActual.setDate(fechaActual.getDate() + 1);
        while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
          fechaActual.setDate(fechaActual.getDate() + 1);
        }
      }
    } else if (esquema === 'semanal') {
      // Un pago cada 7 días, empezando el próximo día hábil
      while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
      for (let i = 0; i < numPagos; i++) {
        pagos.push({
          credito_id: creditoData.id,
          numero_dia: i + 1,
          fecha_esperada: new Date(fechaActual).toLocaleDateString('en-CA'),
          pagado: false,
          pre_existente: false,
        });
        fechaActual.setDate(fechaActual.getDate() + 7);
      }
    } else if (esquema === 'quincenal') {
      // Un pago cada 15 días
      for (let i = 0; i < numPagos; i++) {
        pagos.push({
          credito_id: creditoData.id,
          numero_dia: i + 1,
          fecha_esperada: new Date(fechaActual).toLocaleDateString('en-CA'),
          pagado: false,
          pre_existente: false,
        });
        fechaActual.setDate(fechaActual.getDate() + 15);
      }
    }

    for (let i = 0; i < diasYaPagados; i++) {
      pagos[i].pagado = true;
      pagos[i].pre_existente = true;
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
