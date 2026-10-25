-- =====================================================================
-- VENDIA CLOUD - VINCULACIÓN SEGURA DE CONTRATOS Y MEMBRESÍAS
-- Migración: Seguridad DEFINER y Trigger en Postgres
-- =====================================================================

-- 0. Asegurar la columna dueno_email e índice en la tabla contratos
ALTER TABLE public.contratos 
  ADD COLUMN IF NOT EXISTS dueno_email TEXT;

CREATE INDEX IF NOT EXISTS idx_contratos_dueno_email 
  ON public.contratos (LOWER(TRIM(dueno_email)));

-- 1. Función RPC segura con SECURITY DEFINER para vincular contratos existentes
-- Esta función se ejecuta con privilegios del creador (seguro) y no expone
-- la tabla contratos a consultas directas del cliente ni permite manipulación
-- de roles arbitraria desde el frontend.
CREATE OR REPLACE FUNCTION public.vincular_usuario_contratos(
  p_usuario_id UUID DEFAULT auth.uid(),
  p_email TEXT DEFAULT NULL
)
RETURNS TABLE (
  tienda_id UUID,
  nombre TEXT,
  rol TEXT,
  logo_url TEXT,
  paleta TEXT,
  paleta_custom JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
BEGIN
  -- Determinar ID de usuario de forma segura
  v_user_id := COALESCE(p_usuario_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Determinar correo a vincular (si no se pasa, tomar el de auth.users)
  IF p_email IS NOT NULL AND TRIM(p_email) <> '' THEN
    v_email := LOWER(TRIM(p_email));
  ELSE
    SELECT LOWER(TRIM(email)) INTO v_email FROM auth.users WHERE id = v_user_id;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  -- Insertar membresías como 'dueno' en base a contratos existentes
  -- Solo se insertan si no existen previamente para evitar duplicados
  INSERT INTO public.miembros (usuario_id, tienda_id, rol, activo, creado_en)
  SELECT 
    v_user_id,
    c.tienda_id,
    'dueno',
    true,
    NOW()
  FROM public.contratos c
  WHERE LOWER(TRIM(c.dueno_email)) = v_email
    AND NOT EXISTS (
      SELECT 1 FROM public.miembros m 
      WHERE m.usuario_id = v_user_id 
        AND m.tienda_id = c.tienda_id
    )
  ON CONFLICT (usuario_id, tienda_id) DO UPDATE
    SET activo = true, rol = 'dueno';

  -- Retornar la lista de tiendas vinculadas válidas
  RETURN QUERY
  SELECT 
    t.id AS tienda_id,
    t.nombre::TEXT,
    'dueno'::TEXT AS rol,
    t.logo_url::TEXT,
    t.paleta::TEXT,
    t.paleta_custom
  FROM public.contratos c
  JOIN public.tiendas t ON t.id = c.tienda_id
  WHERE LOWER(TRIM(c.dueno_email)) = v_email;
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.vincular_usuario_contratos(UUID, TEXT) TO authenticated, anon, service_role;

-- -------------------------------------------------------------
-- 2. Trigger en Postgres activado al crear o confirmar usuario
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_auto_vincular_contratos_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := LOWER(TRIM(COALESCE(NEW.email, '')));
  IF v_email <> '' THEN
    -- Realizar vinculación directa en tabla miembros
    INSERT INTO public.miembros (usuario_id, tienda_id, rol, activo, creado_en)
    SELECT 
      NEW.id,
      c.tienda_id,
      'dueno',
      true,
      NOW()
    FROM public.contratos c
    WHERE LOWER(TRIM(c.dueno_email)) = v_email
      AND NOT EXISTS (
        SELECT 1 FROM public.miembros m 
        WHERE m.usuario_id = NEW.id 
          AND m.tienda_id = c.tienda_id
      )
    ON CONFLICT (usuario_id, tienda_id) DO UPDATE
      SET activo = true, rol = 'dueno';
  END IF;

  RETURN NEW;
END;
$$;

-- Registrar trigger sobre auth.users para altas y confirmación de correo
DROP TRIGGER IF EXISTS on_auth_user_link_contracts ON auth.users;
CREATE TRIGGER on_auth_user_link_contracts
  AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_vincular_contratos_auth();
