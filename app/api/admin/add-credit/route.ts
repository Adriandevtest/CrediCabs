import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { cliente_id, monto_total, num_pagos, tasa_interes_porcentaje } = await request.json();

    if (!cliente_id || !monto_total || !num_pagos) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }
    if (num_pagos !== 28 && num_pagos !== 37) {
      return NextResponse.json({ error: 'El esquema debe ser 28 o 37 pagos.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tasaPorcentaje = parseFloat(tasa_interes_porcentaje?.toString() || '0');
    const interesTotal = monto_total * (tasaPorcentaje / 100);
    const cuotaDiaria = (monto_total + interesTotal) / num_pagos;

    const { data: creditoData, error: creditoError } = await supabaseAdmin
      .from('creditos')
      .insert({
        cliente_id,
        monto_total,
        semanas_autorizadas: num_pagos,
        monto_diario: cuotaDiaria,
        tasa_interes_porcentaje: tasaPorcentaje,
        interes_total: interesTotal,
        fecha_inicio: new Date().toISOString().split('T')[0],
        estado: 'activo',
      })
      .select()
      .single();

    if (creditoError) throw creditoError;

    // Generar calendario diario (Lunes-Viernes)
    let fechaActual = new Date();
    while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    const pagos = [];
    for (let i = 0; i < num_pagos; i++) {
      pagos.push({
        credito_id: creditoData.id,
        numero_dia: i + 1,
        fecha_esperada: new Date(fechaActual).toISOString().split('T')[0],
        pagado: false,
      });
      fechaActual.setDate(fechaActual.getDate() + 1);
      while (fechaActual.getDay() === 0 || fechaActual.getDay() === 6) {
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
    }

    const { error: pagosError } = await supabaseAdmin.from('pagos_diarios').insert(pagos);
    if (pagosError) throw pagosError;

    return NextResponse.json({
      success: true,
      creditoId: creditoData.id,
      monto_por_pago: cuotaDiaria,
    });
  } catch (error: any) {
    console.error('Error en add-credit:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
