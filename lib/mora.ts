export const MORA_POR_DIA = 50;

// Devuelve la fecha local como YYYY-MM-DD (evita el desfase UTC en México UTC-6)
function fechaHoy(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function calcularMora(pagos: { fecha_esperada: string; pagado: boolean }[]): number {
  const today = fechaHoy();
  const diasAtrasados = (pagos || []).filter(
    (p) => p.fecha_esperada < today && !p.pagado
  ).length;
  return diasAtrasados * MORA_POR_DIA;
}

export function diasDeMora(pagos: { fecha_esperada: string; pagado: boolean }[]): number {
  const today = fechaHoy();
  return (pagos || []).filter((p) => p.fecha_esperada < today && !p.pagado).length;
}
