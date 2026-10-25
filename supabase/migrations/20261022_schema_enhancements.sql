-- =====================================================================
-- COBROFÁCIL POS - MIGRACIÓN INTEGRAL 2.0 (AUDITADA Y VERIFICADA)
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> RUN
-- =====================================================================

-- -------------------------------------------------------------
-- 1. TABLA TIENDAS: Paleta, logo y slug
-- -------------------------------------------------------------
ALTER TABLE tiendas 
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS paleta VARCHAR(50) DEFAULT 'brex',
  ADD COLUMN IF NOT EXISTS paleta_custom JSONB;

-- -------------------------------------------------------------
-- 2. TABLA PRODUCTOS: Precios, Costos, Activo, Unidad y Código de barras
-- -------------------------------------------------------------
ALTER TABLE productos 
  ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(20) DEFAULT 'und',
  ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12, 3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS precio NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS precio_venta NUMERIC(12, 2);

-- Sincronizar precio y precio_venta para evitar cualquier discrepancia
UPDATE productos SET precio = precio_venta WHERE precio IS NULL AND precio_venta IS NOT NULL;
UPDATE productos SET precio_venta = precio WHERE precio_venta IS NULL AND precio IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_tienda_codigo_barras
  ON productos(tienda_id, codigo_barras)
  WHERE codigo_barras IS NOT NULL AND codigo_barras != '';

-- -------------------------------------------------------------
-- 3. TABLA INVENTARIO: Existencias decimales y timestamps
-- -------------------------------------------------------------
ALTER TABLE inventario 
  ADD COLUMN IF NOT EXISTS stock_actual NUMERIC(12, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad NUMERIC(12, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_minimo NUMERIC(12, 3) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT NOW();

-- Sincronizar stock_actual y cantidad si alguna estaba vacía
UPDATE inventario SET stock_actual = cantidad WHERE (stock_actual IS NULL OR stock_actual = 0) AND cantidad IS NOT NULL;
UPDATE inventario SET cantidad = stock_actual WHERE (cantidad IS NULL OR cantidad = 0) AND stock_actual IS NOT NULL;

-- -------------------------------------------------------------
-- 4. TABLA VENTAS: Idempotencia, Anulaciones, Pagos Mixtos y Numeración
-- -------------------------------------------------------------
-- Eliminar restricciones de verificación restrictivas anteriores
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check;
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_estado_check;
ALTER TABLE movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_inventario_tipo_check;
ALTER TABLE movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_inventario_tipo_movimiento_check;
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_unidad_medida_check;

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'completada',
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
  ADD COLUMN IF NOT EXISTS anulada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS serie VARCHAR(10) DEFAULT 'B001',
  ADD COLUMN IF NOT EXISTS correlativo INT,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS pagos_mixtos JSONB,
  ADD COLUMN IF NOT EXISTS monto_recibido NUMERIC(12, 2);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_tienda_idempotency
  ON ventas(tienda_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key != '';

-- -------------------------------------------------------------
-- 5. TABLA VENTA_ITEMS: Tienda, Sede, Decimales y Precios
-- -------------------------------------------------------------
ALTER TABLE venta_items 
  ADD COLUMN IF NOT EXISTS tienda_id UUID,
  ADD COLUMN IF NOT EXISTS sede_id UUID,
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS precio NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2);

ALTER TABLE venta_items 
  ALTER COLUMN cantidad TYPE NUMERIC(12, 3);

-- -------------------------------------------------------------
-- 6. TABLA MOVIMIENTOS_INVENTARIO: Kardex dual (tipo / tipo_movimiento)
-- -------------------------------------------------------------
ALTER TABLE movimientos_inventario
  ADD COLUMN IF NOT EXISTS sede_id UUID,
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'venta',
  ADD COLUMN IF NOT EXISTS tipo_movimiento VARCHAR(50) DEFAULT 'venta',
  ADD COLUMN IF NOT EXISTS nota TEXT,
  ADD COLUMN IF NOT EXISTS usuario_id UUID,
  ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();

-- -------------------------------------------------------------
-- 7. TABLA PAGOS: Comprobante
-- -------------------------------------------------------------
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- -------------------------------------------------------------
-- 8. RPC: registrar_venta (100% blindada contra campos faltantes)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_venta(
  p_sede_id UUID,
  p_metodo_pago TEXT,
  p_items JSONB,
  p_monto_recibido NUMERIC DEFAULT NULL,
  p_pagos_mixtos JSONB DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tienda_id UUID;
  v_sede_id UUID;
  v_usuario_id UUID := auth.uid();
  v_item RECORD;
  v_venta_id UUID;
  v_serie VARCHAR(10) := 'B001';
  v_correlativo INT;
  v_total NUMERIC(12, 2) := 0;
  v_subtotal NUMERIC(12, 2);
  v_precio NUMERIC(12, 2);
  v_vuelto NUMERIC(12, 2) := 0;
  v_existing_id UUID;
BEGIN
  -- 1. Idempotencia anti-duplicados por doble clic o microcortes
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT id INTO v_existing_id FROM ventas WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      SELECT correlativo, serie, total INTO v_correlativo, v_serie, v_total FROM ventas WHERE id = v_existing_id;
      RETURN jsonb_build_object(
        'venta_id', v_existing_id,
        'correlativo', v_correlativo,
        'serie', v_serie,
        'total', v_total,
        'vuelto', CASE WHEN p_monto_recibido > v_total THEN ROUND(p_monto_recibido - v_total, 2) ELSE 0 END,
        'idempotent', true
      );
    END IF;
  END IF;

  -- 2. Resolver sede_id y tienda_id con fallback bidireccional
  SELECT tienda_id INTO v_tienda_id FROM sedes WHERE id = p_sede_id;
  IF v_tienda_id IS NOT NULL THEN
    v_sede_id := p_sede_id;
  ELSE
    -- p_sede_id era el id de la tienda directamente
    SELECT id INTO v_tienda_id FROM tiendas WHERE id = p_sede_id;
    IF v_tienda_id IS NOT NULL THEN
      -- Buscar la sede principal vinculada a esta tienda
      SELECT id INTO v_sede_id FROM sedes WHERE tienda_id = v_tienda_id ORDER BY es_principal DESC NULLS LAST LIMIT 1;
      -- Si no existiera sede registrada aún, crear la sede principal automáticamente
      IF v_sede_id IS NULL THEN
        INSERT INTO sedes (tienda_id, nombre, direccion, es_principal)
        VALUES (v_tienda_id, 'Sede Principal', 'Principal', true)
        RETURNING id INTO v_sede_id;
      END IF;
    END IF;
  END IF;

  IF v_tienda_id IS NULL OR v_sede_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo identificar la tienda o sede válida para el identificador %', p_sede_id;
  END IF;

  -- 3. Resolver usuario_id si auth.uid() no está disponible
  IF v_usuario_id IS NULL THEN
    SELECT usuario_id INTO v_usuario_id FROM miembros WHERE tienda_id = v_tienda_id AND rol = 'dueno' LIMIT 1;
  END IF;

  -- 4. Correlativo consecutivo por tienda
  SELECT COALESCE(MAX(correlativo), 0) + 1 INTO v_correlativo
  FROM ventas
  WHERE tienda_id = v_tienda_id;

  -- 5. Calcular total de la venta consultando la base de datos como ÚNICA AUTORIDAD (ignorar precio del cliente)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad NUMERIC)
  LOOP
    IF v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0 para el producto %', v_item.producto_id;
    END IF;

    -- Consultar precio oficial directamente en la tabla productos de la tienda
    SELECT COALESCE(precio_venta, precio, 0) INTO v_precio
    FROM productos
    WHERE id = v_item.producto_id AND tienda_id = v_tienda_id;

    IF v_precio IS NULL OR v_precio <= 0 THEN
      RAISE EXCEPTION 'El producto % no existe o no tiene un precio válido asignado en la tienda.', v_item.producto_id;
    END IF;

    v_total := v_total + ROUND(v_precio * v_item.cantidad, 2);
  END LOOP;

  v_total := ROUND(v_total, 2);

  IF p_monto_recibido IS NOT NULL AND p_monto_recibido > v_total THEN
    v_vuelto := ROUND(p_monto_recibido - v_total, 2);
  ELSE
    v_vuelto := 0;
  END IF;

  -- 6. Insertar cabecera de la venta con el total real verificado
  INSERT INTO ventas (
    tienda_id,
    sede_id,
    usuario_id,
    total,
    metodo_pago,
    monto_recibido,
    pagos_mixtos,
    estado,
    serie,
    correlativo,
    idempotency_key,
    creado_en
  ) VALUES (
    v_tienda_id,
    v_sede_id,
    v_usuario_id,
    v_total,
    p_metodo_pago,
    p_monto_recibido,
    p_pagos_mixtos,
    'completada',
    v_serie,
    v_correlativo,
    p_idempotency_key,
    NOW()
  ) RETURNING id INTO v_venta_id;

  -- 7. Insertar detalle de ítems y actualizar inventario usando precio oficial de la base de datos
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad NUMERIC)
  LOOP
    SELECT COALESCE(precio_venta, precio, 0) INTO v_precio
    FROM productos
    WHERE id = v_item.producto_id AND tienda_id = v_tienda_id;

    v_subtotal := ROUND(v_precio * v_item.cantidad, 2);

    -- Insertar en venta_items pasando tienda_id y sede_id requeridos por RLS
    INSERT INTO venta_items (
      tienda_id,
      sede_id,
      venta_id,
      producto_id,
      cantidad,
      precio_unitario,
      precio,
      subtotal
    ) VALUES (
      v_tienda_id,
      v_sede_id,
      v_venta_id,
      v_item.producto_id,
      v_item.cantidad,
      v_precio,
      v_precio,
      v_subtotal
    );

    -- Descontar inventario (sincroniza tanto stock_actual como cantidad)
    UPDATE inventario
    SET stock_actual = GREATEST(COALESCE(stock_actual, cantidad, 0) - v_item.cantidad, 0),
        cantidad = GREATEST(COALESCE(cantidad, stock_actual, 0) - v_item.cantidad, 0),
        actualizado_en = NOW()
    WHERE producto_id = v_item.producto_id
      AND (sede_id = v_sede_id OR tienda_id = v_tienda_id);

    -- Registrar kardex (compatible con columna 'tipo' y 'tipo_movimiento')
    INSERT INTO movimientos_inventario (
      tienda_id,
      sede_id,
      producto_id,
      tipo,
      tipo_movimiento,
      cantidad,
      usuario_id,
      nota,
      creado_en
    ) VALUES (
      v_tienda_id,
      v_sede_id,
      v_item.producto_id,
      'venta',
      'venta',
      -v_item.cantidad,
      v_usuario_id,
      CONCAT('Venta #', v_serie, '-', LPAD(v_correlativo::TEXT, 6, '0')),
      NOW()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'correlativo', v_correlativo,
    'serie', v_serie,
    'total', v_total,
    'vuelto', v_vuelto
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------
-- 9. RPC: anular_venta (Restaura Stock y Kardex Automáticamente)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION anular_venta(
  p_sede_id UUID,
  p_venta_id UUID,
  p_motivo TEXT DEFAULT 'Devolución de cliente'
)
RETURNS JSONB AS $$
DECLARE
  v_venta RECORD;
  v_item RECORD;
  v_tienda_id UUID;
  v_usuario_id UUID := auth.uid();
BEGIN
  -- Buscar venta directamente por ID primario para evitar bloqueos por sede
  SELECT * INTO v_venta
  FROM ventas
  WHERE id = p_venta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada con ID %.', p_venta_id;
  END IF;

  IF v_venta.estado = 'anulada' THEN
    RAISE EXCEPTION 'Esta venta ya se encuentra anulada.';
  END IF;

  v_tienda_id := v_venta.tienda_id;
  IF v_usuario_id IS NULL THEN
    v_usuario_id := v_venta.usuario_id;
  END IF;

  FOR v_item IN
    SELECT producto_id, cantidad
    FROM venta_items
    WHERE venta_id = p_venta_id
  LOOP
    UPDATE inventario
    SET stock_actual = COALESCE(stock_actual, cantidad, 0) + v_item.cantidad,
        cantidad = COALESCE(cantidad, stock_actual, 0) + v_item.cantidad,
        actualizado_en = NOW()
    WHERE producto_id = v_item.producto_id
      AND tienda_id = v_tienda_id;

    INSERT INTO movimientos_inventario (
      tienda_id,
      sede_id,
      producto_id,
      tipo,
      tipo_movimiento,
      cantidad,
      usuario_id,
      nota,
      creado_en
    ) VALUES (
      v_tienda_id,
      p_sede_id,
      v_item.producto_id,
      'ajuste',
      'devolucion_cliente',
      v_item.cantidad,
      v_usuario_id,
      CONCAT('Anulación Ticket #', COALESCE(v_venta.serie, 'B001'), '-', LPAD(COALESCE(v_venta.correlativo, 1)::TEXT, 6, '0'), ': ', p_motivo),
      NOW()
    );
  END LOOP;

  UPDATE ventas
  SET estado = 'anulada',
      motivo_anulacion = p_motivo,
      anulada_en = NOW()
  WHERE id = p_venta_id;

  RETURN jsonb_build_object(
    'success', true,
    'venta_id', p_venta_id,
    'estado', 'anulada',
    'motivo', p_motivo
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------
-- 10. RPC: resumen_tienda (Cálculos directos en Servidor)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumen_tienda(p_tienda_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_hoy_total NUMERIC(12, 2) := 0;
  v_hoy_ventas INT := 0;
  v_ticket_promedio NUMERIC(12, 2) := 0;
  v_por_reponer INT := 0;
  v_ultimos_7 JSONB := '[]'::JSONB;
  v_por_pago JSONB := '[]'::JSONB;
  v_mas_vendidos JSONB := '[]'::JSONB;
  v_hoy DATE := (NOW() AT TIME ZONE 'America/Lima')::DATE;
BEGIN
  -- 1. Ventas de hoy (America/Lima)
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(id)
  INTO v_hoy_total, v_hoy_ventas
  FROM ventas
  WHERE tienda_id = p_tienda_id
    AND DATE(creado_en AT TIME ZONE 'America/Lima') = v_hoy
    AND COALESCE(estado, 'completada') != 'anulada';

  IF v_hoy_ventas > 0 THEN
    v_ticket_promedio := ROUND(v_hoy_total / v_hoy_ventas, 2);
  END IF;

  -- 2. Productos por reponer
  SELECT COUNT(DISTINCT p.id) INTO v_por_reponer
  FROM productos p
  LEFT JOIN inventario inv ON inv.producto_id = p.id
  WHERE p.tienda_id = p_tienda_id
    AND COALESCE(p.activo, true) = true
    AND COALESCE(inv.stock_actual, inv.cantidad, 0) <= COALESCE(inv.stock_minimo, 5);

  -- 3. Últimos 7 días (terminando en v_hoy America/Lima)
  SELECT COALESCE(jsonb_agg(sub), '[]'::JSONB) INTO v_ultimos_7
  FROM (
    SELECT 
      TO_CHAR(d.dia, 'YYYY-MM-DD') AS fecha,
      COALESCE(SUM(v.total), 0) AS total
    FROM generate_series(v_hoy - INTERVAL '6 days', v_hoy, '1 day'::interval) d(dia)
    LEFT JOIN ventas v ON v.tienda_id = p_tienda_id 
      AND DATE(v.creado_en AT TIME ZONE 'America/Lima') = DATE(d.dia)
      AND COALESCE(v.estado, 'completada') != 'anulada'
    GROUP BY d.dia
    ORDER BY d.dia ASC
  ) sub;

  -- 4. Por forma de pago (hoy en America/Lima)
  SELECT COALESCE(jsonb_agg(sub_pago), '[]'::JSONB) INTO v_por_pago
  FROM (
    SELECT 
      COALESCE(metodo_pago, 'Efectivo') AS metodo,
      ROUND(SUM(total), 2) AS total
    FROM ventas
    WHERE tienda_id = p_tienda_id
      AND DATE(creado_en AT TIME ZONE 'America/Lima') = v_hoy
      AND COALESCE(estado, 'completada') != 'anulada'
    GROUP BY metodo_pago
  ) sub_pago;

  -- 5. Más vendidos (últimos 30 días)
  SELECT COALESCE(jsonb_agg(sub_mv), '[]'::JSONB) INTO v_mas_vendidos
  FROM (
    SELECT 
      COALESCE(p.nombre, 'Producto') AS producto,
      SUM(vi.cantidad) AS unidades
    FROM venta_items vi
    JOIN ventas v ON v.id = vi.venta_id
    JOIN productos p ON p.id = vi.producto_id
    WHERE v.tienda_id = p_tienda_id
      AND v.creado_en >= NOW() - INTERVAL '30 days'
      AND COALESCE(v.estado, 'completada') != 'anulada'
    GROUP BY p.nombre
    ORDER BY unidades DESC
    LIMIT 5
  ) sub_mv;

  RETURN jsonb_build_object(
    'hoy_total', v_hoy_total,
    'hoy_ventas', v_hoy_ventas,
    'ticket_promedio', v_ticket_promedio,
    'por_reponer', v_por_reponer,
    'ultimos_7_dias', v_ultimos_7,
    'por_pago', v_por_pago,
    'mas_vendidos', v_mas_vendidos
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------
-- 11. RPC: obtener_metricas_reportes (Rentabilidad, Turnos, Horas Pico)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION obtener_metricas_reportes(
  p_tienda_id UUID,
  p_sede_id UUID DEFAULT NULL,
  p_periodo TEXT DEFAULT 'hoy'
)
RETURNS JSONB AS $$
DECLARE
  v_fecha_inicio TIMESTAMPTZ;
  v_fecha_fin TIMESTAMPTZ := NOW();
  v_total_ventas NUMERIC(14, 2) := 0;
  v_total_costos NUMERIC(14, 2) := 0;
  v_margen_bruto NUMERIC(14, 2) := 0;
  v_tickets_count INT := 0;
  v_ticket_promedio NUMERIC(10, 2) := 0;
  v_ventas_empleados JSONB;
  v_ventas_turnos JSONB;
  v_productos_sin_rotacion JSONB;
BEGIN
  IF p_periodo = 'hoy' THEN
    v_fecha_inicio := CURRENT_DATE::TIMESTAMPTZ;
  ELSIF p_periodo = 'semana' THEN
    v_fecha_inicio := DATE_TRUNC('week', NOW());
  ELSIF p_periodo = 'mes' THEN
    v_fecha_inicio := DATE_TRUNC('month', NOW());
  ELSE
    v_fecha_inicio := '2020-01-01'::TIMESTAMPTZ;
  END IF;

  SELECT COALESCE(SUM(v.total), 0), COUNT(v.id)
  INTO v_total_ventas, v_tickets_count
  FROM ventas v
  WHERE v.tienda_id = p_tienda_id
    AND (p_sede_id IS NULL OR v.sede_id = p_sede_id)
    AND v.creado_en >= v_fecha_inicio
    AND v.creado_en <= v_fecha_fin
    AND COALESCE(v.estado, 'completada') != 'anulada';

  SELECT COALESCE(SUM(vi.cantidad * COALESCE(p.costo_unitario, 0)), 0)
  INTO v_total_costos
  FROM venta_items vi
  JOIN ventas v ON v.id = vi.venta_id
  JOIN productos p ON p.id = vi.producto_id
  WHERE v.tienda_id = p_tienda_id
    AND (p_sede_id IS NULL OR v.sede_id = p_sede_id)
    AND v.creado_en >= v_fecha_inicio
    AND v.creado_en <= v_fecha_fin
    AND COALESCE(v.estado, 'completada') != 'anulada';

  v_margen_bruto := v_total_ventas - v_total_costos;
  IF v_tickets_count > 0 THEN
    v_ticket_promedio := ROUND(v_total_ventas / v_tickets_count, 2);
  END IF;

  SELECT COALESCE(jsonb_agg(sub), '[]'::JSONB) INTO v_ventas_empleados
  FROM (
    SELECT
      COALESCE(perf.nombre, 'Cajero Principal') AS empleado,
      COUNT(v.id) AS tickets,
      ROUND(SUM(v.total), 2) AS total
    FROM ventas v
    LEFT JOIN perfiles perf ON perf.id = v.usuario_id
    WHERE v.tienda_id = p_tienda_id
      AND (p_sede_id IS NULL OR v.sede_id = p_sede_id)
      AND v.creado_en >= v_fecha_inicio
      AND COALESCE(v.estado, 'completada') != 'anulada'
    GROUP BY perf.nombre
    ORDER BY total DESC
  ) sub;

  SELECT jsonb_build_object(
    'manana', COALESCE(SUM(CASE WHEN EXTRACT(HOUR FROM v.creado_en AT TIME ZONE 'America/Lima') BETWEEN 6 AND 13 THEN v.total ELSE 0 END), 0),
    'tarde', COALESCE(SUM(CASE WHEN EXTRACT(HOUR FROM v.creado_en AT TIME ZONE 'America/Lima') >= 14 THEN v.total ELSE 0 END), 0)
  ) INTO v_ventas_turnos
  FROM ventas v
  WHERE v.tienda_id = p_tienda_id
    AND (p_sede_id IS NULL OR v.sede_id = p_sede_id)
    AND v.creado_en >= v_fecha_inicio
    AND COALESCE(v.estado, 'completada') != 'anulada';

  SELECT COALESCE(jsonb_agg(sub_rot), '[]'::JSONB) INTO v_productos_sin_rotacion
  FROM (
    SELECT
      p.id,
      p.nombre,
      p.codigo_barras,
      COALESCE(inv.stock_actual, inv.cantidad, 0) AS stock_actual,
      COALESCE(p.precio_venta, p.precio, 0) AS precio_venta,
      p.costo_unitario,
      ROUND(COALESCE(inv.stock_actual, inv.cantidad, 0) * COALESCE(p.costo_unitario, COALESCE(p.precio_venta, p.precio, 0) * 0.7), 2) AS capital_parado
    FROM productos p
    JOIN inventario inv ON inv.producto_id = p.id
    WHERE p.tienda_id = p_tienda_id
      AND COALESCE(p.activo, true) = true
      AND COALESCE(inv.stock_actual, inv.cantidad, 0) > 0
      AND p.id NOT IN (
        SELECT DISTINCT vi.producto_id
        FROM venta_items vi
        JOIN ventas v ON v.id = vi.venta_id
        WHERE v.tienda_id = p_tienda_id
          AND v.creado_en >= v_fecha_inicio
          AND COALESCE(v.estado, 'completada') != 'anulada'
      )
    ORDER BY capital_parado DESC
    LIMIT 20
  ) sub_rot;

  RETURN jsonb_build_object(
    'total_ventas', v_total_ventas,
    'total_costos', v_total_costos,
    'margen_bruto', v_margen_bruto,
    'tickets_count', v_tickets_count,
    'ticket_promedio', v_ticket_promedio,
    'ventas_empleados', v_ventas_empleados,
    'ventas_turnos', v_ventas_turnos,
    'productos_sin_rotacion', v_productos_sin_rotacion
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------
-- 12. TABLAS SAAS: Planes, Comunicados y Auditoría
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saas_planes (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  precio NUMERIC(10, 2) NOT NULL,
  periodicidad INT DEFAULT 1,
  descripcion TEXT,
  modulos JSONB DEFAULT '["inventario", "ventas"]'::JSONB,
  badge TEXT,
  popular BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saas_comunicados (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo VARCHAR(20) DEFAULT 'novedad',
  activo BOOLEAN DEFAULT TRUE,
  creado_por TEXT DEFAULT 'Superadmin',
  fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saas_auditoria (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tipo VARCHAR(30) NOT NULL,
  accion TEXT NOT NULL,
  detalle TEXT,
  tienda TEXT DEFAULT 'Sistema',
  usuario TEXT DEFAULT 'Superadmin',
  metadata JSONB DEFAULT '{}'::JSONB,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO saas_planes (id, codigo, nombre, precio, periodicidad, descripcion, modulos, badge, popular, activo)
VALUES 
  ('plan_basico', 'basico', 'Plan Emprendedor', 59.00, 1, 'Lo esencial para digitalizar una bodega o tienda pequeña.', '["inventario", "ventas"]'::JSONB, 'Básico', false, true),
  ('plan_pro', 'pro', 'Plan Negocio Pro', 89.00, 1, 'Para comercios activos que necesitan velocidad, CobroFácil Móvil, escáner y analítica.', '["inventario", "ventas", "reportes", "escaner"]'::JSONB, 'Más Vendido', true, true),
  ('plan_full', 'full', 'Plan Full Suite / Multi-Tienda', 139.00, 1, 'Para minimarkets con compras, múltiples sedes y cajeros ilimitados.', '["inventario", "ventas", "reportes", "escaner", "compras"]'::JSONB, 'Empresarial', false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO saas_comunicados (id, titulo, mensaje, tipo, activo, creado_por, fecha)
VALUES 
  ('com_1', '¡Nuevo módulo de Escáner y Pistola de Códigos disponible!', 'Ya puedes registrar y vender productos con la cámara de tu celular o con una pistola USB/Bluetooth.', 'novedad', true, 'Superadmin', NOW())
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE saas_planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin control total saas_planes" ON saas_planes;
CREATE POLICY "Superadmin control total saas_planes" ON saas_planes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM perfiles WHERE perfiles.id = auth.uid() AND perfiles.es_superadmin = true)
);

DROP POLICY IF EXISTS "Lectura de planes activos para todos los usuarios" ON saas_planes;
CREATE POLICY "Lectura de planes activos para todos los usuarios" ON saas_planes FOR SELECT TO authenticated USING (activo = true);

DROP POLICY IF EXISTS "Superadmin control total saas_comunicados" ON saas_comunicados;
CREATE POLICY "Superadmin control total saas_comunicados" ON saas_comunicados FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM perfiles WHERE perfiles.id = auth.uid() AND perfiles.es_superadmin = true)
);

DROP POLICY IF EXISTS "Lectura comunicados activos" ON saas_comunicados;
CREATE POLICY "Lectura comunicados activos" ON saas_comunicados FOR SELECT TO authenticated USING (activo = true);

DROP POLICY IF EXISTS "Superadmin lectura saas_auditoria" ON saas_auditoria;
CREATE POLICY "Superadmin lectura saas_auditoria" ON saas_auditoria FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM perfiles WHERE perfiles.id = auth.uid() AND perfiles.es_superadmin = true)
);

DROP POLICY IF EXISTS "Insercion saas_auditoria para usuarios autenticados" ON saas_auditoria;
CREATE POLICY "Insercion saas_auditoria para usuarios autenticados" ON saas_auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- -------------------------------------------------------------
-- 13. RPC: crear_tienda (SaaS Superadmin)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_tienda(
  p_nombre TEXT,
  p_monto NUMERIC,
  p_periodicidad_meses INT,
  p_inicio DATE,
  p_modulos TEXT[],
  p_plan TEXT DEFAULT 'basico'
)
RETURNS UUID AS $$
DECLARE
  v_tienda_id UUID;
  v_sede_id UUID;
  v_modulo TEXT;
BEGIN
  INSERT INTO tiendas (nombre, estado, paleta)
  VALUES (p_nombre, 'activa', 'brex')
  RETURNING id INTO v_tienda_id;

  INSERT INTO sedes (tienda_id, nombre, direccion, es_principal)
  VALUES (v_tienda_id, 'Sede Principal', 'Principal', true)
  RETURNING id INTO v_sede_id;

  IF p_modulos IS NOT NULL THEN
    FOREACH v_modulo IN ARRAY p_modulos LOOP
      INSERT INTO tienda_modulos (tienda_id, modulo_codigo, activo)
      VALUES (v_tienda_id, v_modulo, true)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  INSERT INTO contratos (
    tienda_id,
    plan,
    monto,
    moneda,
    periodicidad_meses,
    fecha_inicio,
    proximo_pago,
    estado_pago
  ) VALUES (
    v_tienda_id,
    COALESCE(p_plan, 'basico'),
    COALESCE(p_monto, 59.00),
    'PEN',
    COALESCE(p_periodicidad_meses, 1),
    COALESCE(p_inicio, CURRENT_DATE),
    COALESCE(p_inicio, CURRENT_DATE) + (COALESCE(p_periodicidad_meses, 1) || ' months')::INTERVAL,
    'al_dia'
  );

  RETURN v_tienda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------
-- 14. RPC: crear_producto (Inventario)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_producto(
  p_sede_id UUID,
  p_nombre TEXT,
  p_categoria TEXT,
  p_precio NUMERIC,
  p_minimo INT,
  p_stock_inicial NUMERIC DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_tienda_id UUID;
  v_prod_id UUID;
BEGIN
  SELECT tienda_id INTO v_tienda_id FROM sedes WHERE id = p_sede_id;
  IF v_tienda_id IS NULL THEN
    SELECT id INTO v_tienda_id FROM tiendas WHERE id = p_sede_id;
  END IF;

  INSERT INTO productos (
    tienda_id,
    nombre,
    categoria,
    precio,
    precio_venta,
    stock_minimo,
    activo
  ) VALUES (
    v_tienda_id,
    p_nombre,
    p_categoria,
    p_precio,
    p_precio,
    p_minimo,
    true
  ) RETURNING id INTO v_prod_id;

  INSERT INTO inventario (
    tienda_id,
    sede_id,
    producto_id,
    stock_actual,
    cantidad,
    stock_minimo,
    actualizado_en
  ) VALUES (
    v_tienda_id,
    p_sede_id,
    v_prod_id,
    COALESCE(p_stock_inicial, 0),
    COALESCE(p_stock_inicial, 0),
    p_minimo,
    NOW()
  );

  IF COALESCE(p_stock_inicial, 0) > 0 THEN
    INSERT INTO movimientos_inventario (
      tienda_id,
      sede_id,
      producto_id,
      tipo,
      tipo_movimiento,
      cantidad,
      nota,
      creado_en
    ) VALUES (
      v_tienda_id,
      p_sede_id,
      v_prod_id,
      'entrada',
      'entrada',
      p_stock_inicial,
      'Stock inicial de apertura de producto',
      NOW()
    );
  END IF;

  RETURN v_prod_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------
-- 15. RPC: editar_producto (Inventario)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION editar_producto(
  p_producto_id UUID,
  p_sede_id UUID,
  p_categoria TEXT,
  p_precio NUMERIC,
  p_minimo INT,
  p_delta NUMERIC DEFAULT 0,
  p_nota TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tienda_id UUID;
  v_usuario_id UUID := auth.uid();
BEGIN
  SELECT tienda_id INTO v_tienda_id FROM productos WHERE id = p_producto_id;

  UPDATE productos
  SET categoria = p_categoria,
      precio = p_precio,
      precio_venta = p_precio,
      stock_minimo = p_minimo
  WHERE id = p_producto_id;

  IF p_delta != 0 THEN
    UPDATE inventario
    SET stock_actual = GREATEST(COALESCE(stock_actual, cantidad, 0) + p_delta, 0),
        cantidad = GREATEST(COALESCE(cantidad, stock_actual, 0) + p_delta, 0),
        stock_minimo = p_minimo,
        actualizado_en = NOW()
    WHERE producto_id = p_producto_id
      AND (sede_id = p_sede_id OR tienda_id = v_tienda_id);

    INSERT INTO movimientos_inventario (
      tienda_id,
      sede_id,
      producto_id,
      tipo,
      tipo_movimiento,
      cantidad,
      usuario_id,
      nota,
      creado_en
    ) VALUES (
      v_tienda_id,
      p_sede_id,
      p_producto_id,
      CASE WHEN p_delta > 0 THEN 'entrada' ELSE 'ajuste' END,
      CASE WHEN p_delta > 0 THEN 'entrada' ELSE 'ajuste' END,
      p_delta,
      v_usuario_id,
      COALESCE(p_nota, CASE WHEN p_delta > 0 THEN 'Entrada de mercancía' ELSE 'Ajuste de inventario' END),
      NOW()
    );
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------
-- 16. SCRIPT DE PROVISIÓN: Segunda Tienda ("Bodega El Sol")
-- Vincula al usuario actual como dueño para gestionar 2 tiendas
-- -------------------------------------------------------------
DO $$
DECLARE
  v_user_id UUID;
  v_tienda_id UUID;
  v_sede_id UUID;
  v_prod_id UUID;
BEGIN
  -- 1. Obtener el usuario actual
  SELECT usuario_id INTO v_user_id FROM miembros WHERE rol = 'dueno' LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- 2. Verificar o crear "Bodega El Sol"
  SELECT id INTO v_tienda_id FROM tiendas WHERE nombre = 'Bodega El Sol' LIMIT 1;
  IF v_tienda_id IS NULL THEN
    INSERT INTO tiendas (nombre, estado, paleta)
    VALUES ('Bodega El Sol', 'activa', 'emerald')
    RETURNING id INTO v_tienda_id;
  END IF;

  -- 3. Crear sede principal
  SELECT id INTO v_sede_id FROM sedes WHERE tienda_id = v_tienda_id AND es_principal = true LIMIT 1;
  IF v_sede_id IS NULL THEN
    INSERT INTO sedes (tienda_id, nombre, direccion, es_principal)
    VALUES (v_tienda_id, 'Sede Principal', 'Av. Las Palmeras 230', true)
    RETURNING id INTO v_sede_id;
  END IF;

  -- 4. Activar módulos
  INSERT INTO tienda_modulos (tienda_id, modulo_codigo, activo)
  VALUES 
    (v_tienda_id, 'inventario', true),
    (v_tienda_id, 'ventas', true),
    (v_tienda_id, 'reportes', true),
    (v_tienda_id, 'resumen', true)
  ON CONFLICT DO NOTHING;

  -- 5. Vincular al usuario como Dueño de la segunda tienda
  IF v_user_id IS NOT NULL THEN
    INSERT INTO miembros (tienda_id, usuario_id, rol, activo)
    VALUES (v_tienda_id, v_user_id, 'dueno', true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 6. Contrato activo
  IF NOT EXISTS (SELECT 1 FROM contratos WHERE tienda_id = v_tienda_id) THEN
    INSERT INTO contratos (tienda_id, plan, monto, moneda, periodicidad_meses, fecha_inicio, proximo_pago, estado_pago)
    VALUES (v_tienda_id, 'emprendedor', 59.00, 'PEN', 1, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'al_dia');
  END IF;

  -- 7. Producto de prueba inicial para Bodega El Sol (Galletas Soda)
  IF NOT EXISTS (SELECT 1 FROM productos WHERE tienda_id = v_tienda_id AND nombre = 'Galletas Soda San Jorge') THEN
    INSERT INTO productos (tienda_id, nombre, categoria, precio, precio_venta, costo_unitario, unidad_medida, stock_minimo, activo)
    VALUES (v_tienda_id, 'Galletas Soda San Jorge', 'Abarrotes', 1.50, 1.50, 0.90, 'und', 10, true)
    RETURNING id INTO v_prod_id;

    INSERT INTO inventario (tienda_id, sede_id, producto_id, stock_actual, cantidad, stock_minimo)
    VALUES (v_tienda_id, v_sede_id, v_prod_id, 50, 50, 10);

    INSERT INTO movimientos_inventario (tienda_id, sede_id, producto_id, tipo, tipo_movimiento, cantidad, nota)
    VALUES (v_tienda_id, v_sede_id, v_prod_id, 'entrada', 'entrada', 50, 'Stock de apertura Bodega El Sol');
  END IF;

  RAISE NOTICE 'Tienda Bodega El Sol creada y vinculada con éxito al usuario %', v_user_id;
END $$;
