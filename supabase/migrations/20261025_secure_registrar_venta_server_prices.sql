-- =====================================================================
-- MIGRACIÓN: AUTORIDAD ÚNICA DE PRECIOS EN registrar_venta (RPC)
-- El servidor PostgreSQL consulta los precios vigentes en la tabla productos,
-- ignorando cualquier precio enviado desde el navegador o cliente.
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> RUN
-- =====================================================================

-- 0. Limpiar versiones sobrecargadas previas para evitar error 42725 ("function name is not unique")
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc
    WHERE proname = 'registrar_venta'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_venta(
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
  -- 1. Idempotencia anti-duplicados por doble clic o microcortes de red
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

  -- 3. Resolver usuario_id si auth.uid() no estuviera disponible en contexto
  IF v_usuario_id IS NULL THEN
    SELECT usuario_id INTO v_usuario_id FROM miembros WHERE tienda_id = v_tienda_id AND rol = 'dueno' LIMIT 1;
  END IF;

  -- 4. Correlativo consecutivo seguro por tienda
  SELECT COALESCE(MAX(correlativo), 0) + 1 INTO v_correlativo
  FROM ventas
  WHERE tienda_id = v_tienda_id;

  -- 5. Calcular total de la venta consultando la base de datos como ÚNICA AUTORIDAD
  -- Se ignoran por completo los precios enviados desde el navegador para evitar manipulaciones
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

  -- 6. Calcular vuelto oficial con el total autenticado por la base de datos
  IF p_monto_recibido IS NOT NULL AND p_monto_recibido > v_total THEN
    v_vuelto := ROUND(p_monto_recibido - v_total, 2);
  ELSE
    v_vuelto := 0;
  END IF;

  -- 7. Insertar cabecera de la venta con el total real verificado
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

  -- 8. Insertar detalle de ítems y actualizar inventario usando precio oficial de la base de datos
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(producto_id UUID, cantidad NUMERIC)
  LOOP
    SELECT COALESCE(precio_venta, precio, 0) INTO v_precio
    FROM productos
    WHERE id = v_item.producto_id AND tienda_id = v_tienda_id;

    v_subtotal := ROUND(v_precio * v_item.cantidad, 2);

    -- Insertar en venta_items con el precio unitario oficial de BD
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

    -- Descontar inventario físico de forma atómica
    UPDATE inventario
    SET stock_actual = GREATEST(COALESCE(stock_actual, cantidad, 0) - v_item.cantidad, 0),
        cantidad = GREATEST(COALESCE(cantidad, stock_actual, 0) - v_item.cantidad, 0),
        actualizado_en = NOW()
    WHERE producto_id = v_item.producto_id
      AND (sede_id = v_sede_id OR tienda_id = v_tienda_id);

    -- Registrar kardex oficial
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
      'Venta N° ' || v_serie || '-' || LPAD(v_correlativo::TEXT, 6, '0'),
      NOW()
    );
  END LOOP;

  -- Retornar resultado con total real y vuelto exacto
  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'correlativo', v_correlativo,
    'serie', v_serie,
    'total', v_total,
    'vuelto', v_vuelto,
    'idempotent', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_venta(UUID, TEXT, JSONB, NUMERIC, JSONB, TEXT) TO authenticated, anon;
COMMENT ON FUNCTION public.registrar_venta(UUID, TEXT, JSONB, NUMERIC, JSONB, TEXT) IS 'Registra ventas con cálculo atómico y precios consultados exclusivamente en base de datos';
