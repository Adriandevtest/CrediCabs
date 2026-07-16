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

-- 2026-07-16: la función original solo sumaba pagos con pagado=true, así que
-- los abonos parciales (monto_pagado > 0 pero pagado=false, ver sección
-- "Abonos Parciales" del dashboard) quedaban afuera del total — dinero real
-- ya cobrado a clientes que no se reflejaba en Capital Actual, haciéndolo ver
-- más negativo de lo que es en realidad. Se agrega total_abonos_parciales.
-- DROP requerido: cambia el shape del RETURNS TABLE, y Postgres no permite
-- que CREATE OR REPLACE altere las columnas de salida de una función existente.
DROP FUNCTION IF EXISTS total_cobrado_historico();

CREATE OR REPLACE FUNCTION total_cobrado_historico()
RETURNS TABLE (total_cuotas numeric, total_mora numeric, total_abonos_parciales numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN pd.pagado THEN c.monto_diario ELSE 0 END), 0) AS total_cuotas,
    COALESCE(SUM(CASE WHEN pd.pagado THEN pd.mora ELSE 0 END), 0)        AS total_mora,
    COALESCE(SUM(CASE WHEN NOT pd.pagado THEN pd.monto_pagado ELSE 0 END), 0) AS total_abonos_parciales
  FROM pagos_diarios pd
  JOIN creditos c ON c.id = pd.credito_id
  WHERE pd.pagado = true OR pd.monto_pagado > 0;
$$;

-- Uso desde el cliente (supabase-js):
--   const { data } = await supabase.rpc('total_cobrado_historico').single();
--   // data.total_cuotas, data.total_mora, data.total_abonos_parciales
