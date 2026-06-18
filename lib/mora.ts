export const MORA_POR_DIA = 50;

/**
 * Calcula el total de mora a partir del cronograma de pagos_diarios.
 * Un pago genera mora si su fecha_esperada es estrictamente anterior a hoy
 * y todavía no ha sido marcado como pagado.
 */
export function calcularMora(pagos: { fecha_esperada: string; pagado: boolean }[]): number {
  const today = new Date().toISOString().split('T')[0];
  const diasAtrasados = (pagos || []).filter(
    (p) => p.fecha_esperada < today && !p.pagado
  ).length;
  return diasAtrasados * MORA_POR_DIA;
}

/**
 * Cuenta cuántos días de mora tiene un crédito (días sin pagar antes de hoy).
 */
export function diasDeMora(pagos: { fecha_esperada: string; pagado: boolean }[]): number {
  const today = new Date().toISOString().split('T')[0];
  return (pagos || []).filter((p) => p.fecha_esperada < today && !p.pagado).length;
}
