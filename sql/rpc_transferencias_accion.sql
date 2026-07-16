-- Aprobar/rechazar transferencias de forma atómica.
-- Antes, app/api/transferencias/accion/route.ts hacía varios UPDATE sueltos
-- (pagos_diarios -> transferencias -> creditos). Si el proceso se interrumpía
-- a mitad de camino (crash, timeout serverless, etc.) podía quedar un pago
-- marcado como pagado sin que la transferencia se marcara como aprobada.
-- Al mover la lógica a una función plpgsql, todo corre en una sola transacción:
-- si algo falla a mitad de camino, Postgres revierte TODO automáticamente.

create or replace function aprobar_transferencia(
  p_transferencia_id uuid,
  p_pago_id uuid default null
)
returns table (
  cliente_id uuid,
  credito_id uuid,
  cobrador_id uuid,
  supervisor_id uuid,
  monto numeric,
  pagos_actualizados int,
  credito_liquidado boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trans record;
  v_cobrador_id uuid;
  v_supervisor_id uuid;
  v_today date := current_date;
  v_pagos_actualizados int := 0;
  v_pendientes_restantes int;
  v_liquidado boolean := false;
begin
  select t.cliente_id, t.credito_id, t.monto, t.estado
    into v_trans
    from transferencias t
    where t.id = p_transferencia_id
    for update;

  if not found then
    raise exception 'Transferencia % no encontrada', p_transferencia_id;
  end if;

  -- Evita doble-aprobación por doble clic o dos admins actuando a la vez.
  if v_trans.estado <> 'pendiente' then
    raise exception 'La transferencia ya fue procesada (estado=%)', v_trans.estado;
  end if;

  select c.cobrador_asignado_id into v_cobrador_id
    from clientes c where c.id = v_trans.cliente_id;

  if v_trans.credito_id is not null then
    select cr.creado_por into v_supervisor_id
      from creditos cr where cr.id = v_trans.credito_id;
  end if;

  -- Nota: "credito_id" también es el nombre de una columna de salida en el
  -- RETURNS TABLE de esta función, así que dentro del cuerpo se vuelve un
  -- identificador ambiguo frente a las columnas de las tablas del mismo
  -- nombre. Por eso cada referencia a columnas de tabla va con alias explícito
  -- (pd.credito_id, etc.) en vez de nombres sueltos.
  if v_trans.credito_id is not null then
    with vencidos as (
      select pd.id, pd.fecha_esperada
      from pagos_diarios pd
      where pd.credito_id = v_trans.credito_id
        and pd.pagado = false
        and pd.fecha_esperada <= v_today
      order by pd.numero_dia
      for update
    )
    update pagos_diarios pd
    set pagado = true,
        mora = case when vencidos.fecha_esperada = v_today then 0 else 50 end
    from vencidos
    where pd.id = vencidos.id;

    get diagnostics v_pagos_actualizados = row_count;

    -- No había vencidos, pero vino un pago específico (pago de hoy sin atraso).
    if v_pagos_actualizados = 0 and p_pago_id is not null then
      update pagos_diarios pd
      set pagado = true, mora = 0
      where pd.id = p_pago_id and pd.credito_id = v_trans.credito_id;
      get diagnostics v_pagos_actualizados = row_count;
    end if;
  end if;

  update transferencias
  set estado = 'aprobado'
  where id = p_transferencia_id;

  if v_trans.credito_id is not null then
    select count(*) into v_pendientes_restantes
      from pagos_diarios pd
      where pd.credito_id = v_trans.credito_id and pd.pagado = false;

    if v_pendientes_restantes = 0 then
      update creditos set estado = 'liquidado' where id = v_trans.credito_id;
      v_liquidado := true;
    end if;
  end if;

  return query select
    v_trans.cliente_id, v_trans.credito_id, v_cobrador_id, v_supervisor_id,
    v_trans.monto, v_pagos_actualizados, v_liquidado;
end;
$$;

create or replace function rechazar_transferencia(
  p_transferencia_id uuid
)
returns table (
  cliente_id uuid,
  credito_id uuid,
  cobrador_id uuid,
  supervisor_id uuid,
  monto numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trans record;
  v_cobrador_id uuid;
  v_supervisor_id uuid;
begin
  select t.cliente_id, t.credito_id, t.monto, t.estado
    into v_trans
    from transferencias t
    where t.id = p_transferencia_id
    for update;

  if not found then
    raise exception 'Transferencia % no encontrada', p_transferencia_id;
  end if;

  if v_trans.estado <> 'pendiente' then
    raise exception 'La transferencia ya fue procesada (estado=%)', v_trans.estado;
  end if;

  select c.cobrador_asignado_id into v_cobrador_id
    from clientes c where c.id = v_trans.cliente_id;

  if v_trans.credito_id is not null then
    select cr.creado_por into v_supervisor_id
      from creditos cr where cr.id = v_trans.credito_id;
  end if;

  update transferencias set estado = 'rechazado' where id = p_transferencia_id;

  return query select v_trans.cliente_id, v_trans.credito_id, v_cobrador_id, v_supervisor_id, v_trans.monto;
end;
$$;
