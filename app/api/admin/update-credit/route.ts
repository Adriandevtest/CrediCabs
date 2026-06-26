import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { credito_id, monto_total, num_pagos } = await request.json();

    if (!credito_id || !monto_total || !num_pagos) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }
    if (num_pagos !== 28 && num_pagos !== 37) {
      return NextResponse.json({ error: 'El esquema debe ser 28 o 37 pagos.' }, { status: 400 });
    }
    if (typeof monto_total !== 'number' || monto_total <= 0) {
      return NextResponse.json({ error: 'El monto debe ser un número positivo.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener crédito actual para conservar tasa y fecha de inicio
    const { data: creditoActual, error: fetchError } = await supabaseAdmin
      .from('creditos')
      .select('tasa_interes_porcentaje, fecha_inicio')
      .eq('id', credito_id)
      .single();

    if (fetchError) throw fetchError;

    // Esquema diario: 28 o 37 pagos de Lunes a Viernes
    const tasa = Number(creditoActual.tasa_interes_porcentaje || 0);
    const interesTotal = monto_total * (tasa / 100);
    const cuotaDiaria = (monto_total + interesTotal) / num_pagos;

    // 1. Actualizar el crédito
    const { error: creditoError } = await supabaseAdmin
      .from('creditos')
      .update({
        monto_total,
        semanas_autorizadas: num_pagos,
        monto_diario: cuotaDiaria,
        interes_total: interesTotal,
      })
      .eq('id', credito_id);

    if (creditoError) throw creditoError;

    // 2. Eliminar el calendario antiguo
    const { error: deleteError } = await supabaseAdmin
      .from('pagos_diarios')
      .delete()
      .eq('credito_id', credito_id);

    if (deleteError) throw deleteError;

    // 3. Generar nuevo calendario diario (un pago por día hábil, Lunes-Viernes)
    let fechaActual = new Date(creditoActual.fecha_inicio || new Date());

    // Si la fecha de inicio cae en fin de semana, avanzar al lunes
    while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    const pagos = [];
    for (let i = 0; i < num_pagos; i++) {
      pagos.push({
        credito_id,
        numero_dia: i + 1,
        fecha_esperada: new Date(fechaActual).toISOString().split('T')[0],
        pagado: false,
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
      monto_por_pago: cuotaDiaria,
    });

  } catch (error: any) {
    console.error('Error en update-credit:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
