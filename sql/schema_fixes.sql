-- ============================================================================
-- CrediCabs — fix: vincula solicitudes con el cliente que originaron
-- ============================================================================
-- Bug encontrado al auditar queries para sql/indexes.sql:
-- TableWithDialog.tsx consulta `solicitudes.cliente_id` para mostrar el INE
-- y comprobante del expediente ("Ver más → documentos"), pero esa columna
-- nunca existió — la tabla solo tenía asesor_id. La query fallaba en
-- silencio (el catch la esconde como "sin documentos") desde que se agregó
-- ese filtro.
--
-- Este script agrega la columna y dispara la app (ver
-- app/api/admin/create-client/route.ts y app/bandeja/page.tsx) ya quedó
-- actualizada para llenarla cuando el admin aprueba un prospecto desde
-- Bandeja: se guarda solicitud_id al crear el cliente y la API hace
-- UPDATE solicitudes SET cliente_id = <nuevo cliente>.
--
-- Seguro de correr más de una vez (IF NOT EXISTS). Los clientes creados
-- ANTES de este fix quedarán con solicitudes.cliente_id en NULL — no hay
-- forma retroactiva de saber qué solicitud originó cada cliente antiguo.
-- ============================================================================

ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes (id);

CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente_created
  ON solicitudes (cliente_id, created_at DESC);
