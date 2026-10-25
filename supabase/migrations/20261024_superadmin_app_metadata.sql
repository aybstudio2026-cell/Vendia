-- =====================================================================
-- VENDIA CLOUD - SEGURIDAD Y PREVENCIÓN DE ESCALADA DE PRIVILEGIOS
-- Mover bandera es_superadmin a app_metadata del JWT en Supabase Auth
-- =====================================================================

-- 1. Sincronizar usuarios existentes con es_superadmin en public.perfiles
-- hacia los raw_app_meta_data en auth.users (gestionables solo por service_role)
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"es_superadmin": true}'::jsonb
WHERE id IN (
  SELECT id FROM public.perfiles WHERE es_superadmin = true
);

-- 2. Función helper en SQL para verificar superadmin desde el JWT de Supabase
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'es_superadmin')::boolean,
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin',
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, anon, service_role;

-- 3. Función segura para asignar o revocar superadmin
-- Solo puede ser ejecutada por service_role o por otro superadmin autenticado
CREATE OR REPLACE FUNCTION public.set_user_superadmin(
  p_user_id UUID,
  p_is_super BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_superadmin() AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'No autorizado para asignar privilegios de superadministrador';
  END IF;

  -- Actualizar claims seguros en auth.users (app_metadata)
  UPDATE auth.users
  SET raw_app_meta_data = 
    CASE 
      WHEN p_is_super THEN COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"es_superadmin": true}'::jsonb
      ELSE raw_app_meta_data - 'es_superadmin'
    END
  WHERE id = p_user_id;

  -- Sincronizar en tabla perfiles para auditoría y visualización
  UPDATE public.perfiles
  SET es_superadmin = p_is_super
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_superadmin(UUID, BOOLEAN) TO authenticated, service_role;

-- 4. Trigger en perfiles para evitar escalada de privilegios (Privilege Escalation)
-- Si un usuario malicioso intenta un UPDATE perfiles SET es_superadmin = true,
-- el trigger revierte el cambio a menos que el usuario sea superadmin verificado en JWT
CREATE OR REPLACE FUNCTION public.trg_prevent_superadmin_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.es_superadmin IS DISTINCT FROM OLD.es_superadmin THEN
    IF NOT public.is_superadmin() AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
      NEW.es_superadmin := OLD.es_superadmin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_perfiles_superadmin ON public.perfiles;
CREATE TRIGGER trg_protect_perfiles_superadmin
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_superadmin_escalation();
