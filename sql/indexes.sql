-- ============================================================================
-- CrediCabs — índices dirigidos a los patrones reales de queries del código
-- ============================================================================
-- Generado a partir de una auditoría de todas las llamadas .from()/.eq()/
-- .in()/.lt()/.lte()/.order() en app/, components/ y lib/. Cada índice tiene
-- un comentario indicando qué query(s) acelera.
--
-- Seguro de ejecutar más de una vez (IF NOT EXISTS). Pensado para correr de
-- una sola vez en el SQL Editor de Supabase.
--
-- Antes de correr esto, puedes ver los índices que ya existen con:
--   SELECT tablename, indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--   ORDER BY tablename, indexname;
-- ============================================================================

-- ── clientes ─────────────────────────────────────────────────────────────
-- Filtrado constante en: ruta del cobrador, progreso del día (equipo),
-- mora, reasignación de cliente.
CREATE INDEX IF NOT EXISTS idx_clientes_cobrador_asignado_id
  ON clientes (cobrador_asignado_id);

-- ORDER BY numero_cliente DESC + LIMIT 200 en el listado de clientes
-- (TableWithDialog.tsx) y ORDER BY DESC en ClientTable.tsx.
CREATE INDEX IF NOT EXISTS idx_clientes_numero_cliente
  ON clientes (numero_cliente DESC);


-- ── creditos ─────────────────────────────────────────────────────────────
-- El filtro más común de toda la app: WHERE cliente_id = ... (alta, edición,
-- borrado, panel-cliente, dashboard).
CREATE INDEX IF NOT EXISTS idx_creditos_cliente_id
  ON creditos (cliente_id);

-- .in('estado', ['activo','atrasado']) en CreditosActivos.tsx y el .or(...)
-- equivalente en el dashboard (app/page.tsx).
CREATE INDEX IF NOT EXISTS idx_creditos_estado
  ON creditos (estado);

-- .select('creado_por').eq('id', ...) en /api/transferencias/accion y
-- /api/transferencias/crear (para notificar al supervisor dueño del crédito).
CREATE INDEX IF NOT EXISTS idx_creditos_creado_por
  ON creditos (creado_por);


-- ── pagos_diarios ────────────────────────────────────────────────────────
-- La tabla más consultada del sistema. Patrón dominante:
--   .eq('credito_id', X).eq('pagado', false).lte/lt('fecha_esperada', hoy)
-- en app/cobrador (registrar pago, cobrar mora), /api/transferencias/accion,
-- /api/admin/transferencias-pendientes. El orden de columnas (igualdad
-- primero, rango al final) es el óptimo para un índice btree compuesto.
CREATE INDEX IF NOT EXISTS idx_pagos_diarios_credito_pagado_fecha
  ON pagos_diarios (credito_id, pagado, fecha_esperada);

-- Cubre además /api/admin/pagos-creditos: .in('credito_id', [...]) sin
-- filtro de pagado, ordenado por fecha_esperada.
CREATE INDEX IF NOT EXISTS idx_pagos_diarios_credito_id
  ON pagos_diarios (credito_id);

-- Índice parcial para las queries "globales" del dashboard (app/page.tsx)
-- que buscan pagos vencidos/de hoy SIN filtrar por credito_id primero
-- (recorren pagos_diarios completa). Al excluir pagado=true del índice,
-- se mantiene chico y rápido aunque la tabla crezca con el historial.
CREATE INDEX IF NOT EXISTS idx_pagos_diarios_pendientes_fecha
  ON pagos_diarios (fecha_esperada)
  WHERE pagado = false;


-- ── profiles ─────────────────────────────────────────────────────────────
-- .eq('rol','cobrador') / .in('rol', ['supervisor','cobrador']) en equipo,
-- cobrador, login y varias rutas /api/admin/*.
CREATE INDEX IF NOT EXISTS idx_profiles_rol
  ON profiles (rol);


-- ── notificaciones ───────────────────────────────────────────────────────
-- NotifBell.tsx filtra por uno u otro y siempre ordena por created_at DESC
-- con LIMIT 40 — el índice compuesto evita el sort en tiempo de ejecución.
CREATE INDEX IF NOT EXISTS idx_notificaciones_rol_created
  ON notificaciones (destinatario_rol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_id_created
  ON notificaciones (destinatario_id, created_at DESC);


-- ── solicitudes ──────────────────────────────────────────────────────────
-- Bandeja de aprobación: WHERE estado = 'pendiente' ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado_created
  ON solicitudes (estado, created_at DESC);

-- Listado propio del asesor/supervisor en app/supervisor.
CREATE INDEX IF NOT EXISTS idx_solicitudes_asesor_created
  ON solicitudes (asesor_id, created_at DESC);

-- NOTA: se quitó un índice sobre solicitudes(cliente_id) porque esa columna
-- no existe en la tabla. TableWithDialog.tsx:277 hace
-- .eq('cliente_id', clienteId) contra 'solicitudes', pero esta tabla nunca
-- guarda cliente_id (solo asesor_id — ver components/SupervisorForm.tsx).
-- Es un bug de la app (la query falla y el catch la esconde como "sin
-- documentos"), no algo que un índice pueda resolver. Ver mensaje aparte.


-- ── transferencias ───────────────────────────────────────────────────────
-- /api/admin/transferencias-pendientes: WHERE estado='pendiente'
-- ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_transferencias_estado_created
  ON transferencias (estado, created_at DESC);


-- ── ubicaciones ──────────────────────────────────────────────────────────
-- MapaCobradoresLive.tsx ordena por updated_at DESC para pintar la posición
-- más reciente de cada cobrador.
CREATE INDEX IF NOT EXISTS idx_ubicaciones_updated_at
  ON ubicaciones (updated_at DESC);

-- Nota: no se agrega índice único en ubicaciones(user_id) ni en
-- push_tokens(token) porque el upsert con onConflict que ya usa el código
-- (GeoTracker.tsx, register-token) requiere que esa restricción única ya
-- exista — de lo contrario el upsert actual fallaría en producción.


-- ── push_tokens ──────────────────────────────────────────────────────────
-- lib/sendPush.ts: .eq('cliente_id', X) y .in('user_id', [...]) al armar
-- el fan-out de notificaciones push.
CREATE INDEX IF NOT EXISTS idx_push_tokens_cliente_id
  ON push_tokens (cliente_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
  ON push_tokens (user_id);


-- ============================================================================
-- Verificación rápida después de correr este script:
--
--   SELECT schemaname, relname AS tabla, indexrelname AS indice, idx_scan
--   FROM pg_stat_user_indexes
--   WHERE schemaname = 'public'
--   ORDER BY relname, indexrelname;
--
-- idx_scan empieza en 0 y sube cada vez que Postgres usa el índice — es la
-- forma de confirmar, después de unos días de uso real, que efectivamente
-- se están aprovechando.
-- ============================================================================
