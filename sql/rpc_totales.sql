-- ============================================================================
-- CrediCabs — RPC de agregados para el dashboard (evita traer todo el
-- historial de pagos al navegador)
-- ============================================================================
-- Encontrado al auditar el dashboard para la estrategia de cache: la
-- funcion cargarDatosDashboard() en app/page.tsx traia TODOS los pagos
-- pagados desde siempre (sin limite de fecha) para sumar monto_diario+mora
-- en el navegador con un .reduce(), y volvia a hacerlo en cada evento de
-- tiempo real (cualquier cobrador registrando un pago, en cualquier parte).
-- Esa query crece sin limite con el historico del negocio y se re-ejecuta
-- con mucha frecuencia.
--
-- Este RPC hace la suma en Postgres (un solo numero viaja al navegador en
-- vez de miles de filas) y se apoya en el indice parcial
-- idx_pagos_diarios_pendientes_fecha... en realidad ese es para pagado=false;
-- aqui se agrega uno simetrico para pagado=true.
-- ============================================================================

-- Índice de soporte: acelera el SUM sobre pagos ya cobrados.
CREATE INDEX IF NOT EXISTS idx_pagos_diarios_pagados
  ON pagos_diarios (credito_id)
  WHERE pagado = true;

CREATE OR REPLACE FUNCTION total_cobrado_historico()
RETURNS TABLE (total_cuotas numeric, total_mora numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(c.monto_diario), 0)  AS total_cuotas,
    COALESCE(SUM(pd.mora), 0)         AS total_mora
  FROM pagos_diarios pd
  JOIN creditos c ON c.id = pd.credito_id
  WHERE pd.pagado = true;
$$;

-- Uso desde el cliente (supabase-js):
--   const { data } = await supabase.rpc('total_cobrado_historico').single();
--   // data.total_cuotas, data.total_mora
