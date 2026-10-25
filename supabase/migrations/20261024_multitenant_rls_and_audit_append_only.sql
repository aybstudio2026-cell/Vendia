-- =====================================================================
-- MIGRACIÓN: AISLAMIENTO MULTI-TENANT (RLS) Y AUDITORÍA APPEND-ONLY
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> RUN
-- =====================================================================

-- -------------------------------------------------------------
-- 0. FUNCIONES AUXILIARES DE SEGURIDAD (SECURITY DEFINER)
-- -------------------------------------------------------------

-- Función para verificar si el usuario es Superadmin de forma rápida y segura
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'es_superadmin')::boolean,
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND es_superadmin = true),
    false
  );
$$;

-- Función para obtener las tiendas de un usuario activo sin provocar recursión infinita en miembros
CREATE OR REPLACE FUNCTION public.get_auth_tiendas()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tienda_id FROM public.miembros WHERE usuario_id = auth.uid() AND activo = true;
$$;

-- -------------------------------------------------------------
-- 1. AISLAMIENTO MULTI-TENANT: TIENDAS
-- -------------------------------------------------------------
ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multi-tenant tiendas" ON public.tiendas;
CREATE POLICY "Aislamiento multi-tenant tiendas" ON public.tiendas
  FOR ALL TO authenticated
  USING (
    id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  )
  WITH CHECK (
    id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  );

-- -------------------------------------------------------------
-- 2. AISLAMIENTO MULTI-TENANT: PRODUCTOS
-- -------------------------------------------------------------
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multi-tenant productos" ON public.productos;
CREATE POLICY "Aislamiento multi-tenant productos" ON public.productos
  FOR ALL TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  )
  WITH CHECK (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  );

-- -------------------------------------------------------------
-- 3. AISLAMIENTO MULTI-TENANT: VENTAS
-- -------------------------------------------------------------
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multi-tenant ventas" ON public.ventas;
CREATE POLICY "Aislamiento multi-tenant ventas" ON public.ventas
  FOR ALL TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  )
  WITH CHECK (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  );

-- -------------------------------------------------------------
-- 4. AISLAMIENTO MULTI-TENANT: INVENTARIO
-- -------------------------------------------------------------
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multi-tenant inventario" ON public.inventario;
CREATE POLICY "Aislamiento multi-tenant inventario" ON public.inventario
  FOR ALL TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  )
  WITH CHECK (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  );

-- -------------------------------------------------------------
-- 5. AISLAMIENTO MULTI-TENANT: MIEMBROS (Protegida anti-recursión)
-- -------------------------------------------------------------
ALTER TABLE public.miembros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multi-tenant miembros" ON public.miembros;
CREATE POLICY "Aislamiento multi-tenant miembros" ON public.miembros
  FOR ALL TO authenticated
  USING (
    usuario_id = auth.uid()
    OR tienda_id IN (SELECT public.get_auth_tiendas())
    OR public.is_superadmin()
  )
  WITH CHECK (
    usuario_id = auth.uid()
    OR tienda_id IN (SELECT public.get_auth_tiendas())
    OR public.is_superadmin()
  );

-- -------------------------------------------------------------
-- 6. TABLAS DE APOYO OPERATIVAS: VENTA_ITEMS Y MOVIMIENTOS
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS public.venta_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multi-tenant venta_items" ON public.venta_items;
CREATE POLICY "Aislamiento multi-tenant venta_items" ON public.venta_items
  FOR ALL TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  )
  WITH CHECK (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  );

ALTER TABLE IF EXISTS public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multi-tenant movimientos_inventario" ON public.movimientos_inventario;
CREATE POLICY "Aislamiento multi-tenant movimientos_inventario" ON public.movimientos_inventario
  FOR ALL TO authenticated
  USING (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  )
  WITH CHECK (
    tienda_id IN (
      SELECT tienda_id FROM public.miembros 
      WHERE usuario_id = auth.uid() AND activo = true
    )
    OR public.is_superadmin()
  );

-- -------------------------------------------------------------
-- 7. SAAS_AUDITORIA: APPEND-ONLY SECURITY LOG (INMUTABILIDAD TOTAL)
-- -------------------------------------------------------------
ALTER TABLE public.saas_auditoria ENABLE ROW LEVEL SECURITY;

-- 7.1. Políticas RLS: Lectura para superadmin e inserción para auditoría
DROP POLICY IF EXISTS "Superadmin lectura saas_auditoria" ON public.saas_auditoria;
CREATE POLICY "Superadmin lectura saas_auditoria" ON public.saas_auditoria 
  FOR SELECT TO authenticated 
  USING (public.is_superadmin());

DROP POLICY IF EXISTS "Insercion saas_auditoria para usuarios autenticados" ON public.saas_auditoria;
CREATE POLICY "Insercion saas_auditoria para usuarios autenticados" ON public.saas_auditoria 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

-- No se definen políticas para UPDATE ni DELETE, lo que niega por defecto en RLS.

-- 7.2. Revocar privilegios explícitos de mutación sobre la tabla
REVOKE UPDATE, DELETE ON TABLE public.saas_auditoria FROM anon, authenticated;

-- 7.3. Reglas de Postgres (Append-Only): Descarta cualquier UPDATE o DELETE silencioso
CREATE OR REPLACE RULE no_update_saas_auditoria AS
  ON UPDATE TO public.saas_auditoria
  DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_saas_auditoria AS
  ON DELETE TO public.saas_auditoria
  DO INSTEAD NOTHING;

-- 7.4. Trigger de protección: Lanza excepción si alguien intenta UPDATE o DELETE
CREATE OR REPLACE FUNCTION public.prevent_saas_auditoria_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operación rechazada: la tabla saas_auditoria es un log inmutable de solo adición (Append-Only). No se permite modificar (UPDATE) ni eliminar (DELETE) registros registrados.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_saas_auditoria_mutation ON public.saas_auditoria;
CREATE TRIGGER trg_prevent_saas_auditoria_mutation
  BEFORE UPDATE OR DELETE ON public.saas_auditoria
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_saas_auditoria_mutation();
