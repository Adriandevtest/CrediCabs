-- Soporte para "Registrar Cliente Existente": clientes que el admin ya traía
-- en papel y que ya llevan N días de pago cubiertos antes de entrar a la app.
-- Esos días se marcan pagado=true (para que el calendario/progreso del
-- cliente sea correcto) pero NO deben sumar a Capital Actual — ese dinero se
-- cobró en papel, no es un cobro registrado por la operación en la app.

ALTER TABLE pagos_diarios
  ADD COLUMN IF NOT EXISTS pre_existente boolean NOT NULL DEFAULT false;

-- total_cobrado_historico() ahora excluye pagos pre_existente=true de la suma.
DROP FUNCTION IF EXISTS total_cobrado_historico();

CREATE OR REPLACE FUNCTION total_cobrado_historico()
RETURNS TABLE (total_cuotas numeric, total_mora numeric, total_abonos_parciales numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN pd.pagado AND NOT pd.pre_existente THEN c.monto_diario ELSE 0 END), 0) AS total_cuotas,
    COALESCE(SUM(CASE WHEN pd.pagado AND NOT pd.pre_existente THEN pd.mora ELSE 0 END), 0)        AS total_mora,
    COALESCE(SUM(CASE WHEN NOT pd.pagado THEN pd.monto_pagado ELSE 0 END), 0) AS total_abonos_parciales
  FROM pagos_diarios pd
  JOIN creditos c ON c.id = pd.credito_id
  WHERE pd.pagado = true OR pd.monto_pagado > 0;
$$;
