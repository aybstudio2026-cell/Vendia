import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../common/Modal';
import { money, UNIDADES_MEDIDA, getUnidadMedida } from '../../constants/palettes';
import { IconUpload, IconDownload, IconAlertTriangle } from '../common/Icons';

export default function ImportarInventarioModal({
  isOpen,
  onClose,
  onImportProducts,
  existingProducts = []
}) {
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]); // [{ status: 'valid'|'duplicate'|'error', data, errors: [] }]
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewFilter, setPreviewFilter] = useState('todos'); // 'todos' | 'validos' | 'duplicados' | 'errores'
  const [updateExistingStock, setUpdateExistingStock] = useState(false);

  if (!isOpen) return null;

  // Descargar plantilla Excel oficial con columnas de unidades y costos
  const handleDownloadTemplate = (format = 'xlsx') => {
    const templateData = [
      {
        codigo_barras: '7750106001012',
        nombre: 'Leche Gloria Entera 400g',
        categoria: 'Lácteos',
        unidad_medida: 'und',
        precio_venta: 4.50,
        costo_unitario: 3.50,
        stock: 24,
        stock_minimo: 6
      },
      {
        codigo_barras: '7750885002011',
        nombre: 'Aceite Primor Clásico 1 L',
        categoria: 'Abarrotes',
        unidad_medida: 'l',
        precio_venta: 9.80,
        costo_unitario: 7.90,
        stock: 12,
        stock_minimo: 5
      },
      {
        codigo_barras: '7750243003022',
        nombre: 'Arroz Costeño Extra 1 kg',
        categoria: 'Abarrotes',
        unidad_medida: 'kg',
        precio_venta: 4.80,
        costo_unitario: 3.80,
        stock: 35.5,
        stock_minimo: 10
      },
      {
        codigo_barras: '7750123004033',
        nombre: 'Pollo fresco por peso',
        categoria: 'Carnes',
        unidad_medida: 'kg',
        precio_venta: 11.50,
        costo_unitario: 8.90,
        stock: 45.250,
        stock_minimo: 8
      },
      {
        codigo_barras: '7750567005044',
        nombre: 'Inca Kola 1.5 L Retornable',
        categoria: 'Bebidas',
        unidad_medida: 'und',
        precio_venta: 6.50,
        costo_unitario: 5.10,
        stock: 18,
        stock_minimo: 6
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');

    if (format === 'csv') {
      XLSX.writeFile(workbook, 'Plantilla_Inventario_CobroFacil.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, 'Plantilla_Inventario_CobroFacil.xlsx');
    }
  };

  // Normalizar encabezados para flexibilidad
  const normalizeKey = (key) => {
    const clean = String(key || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
    if (['codigobarras', 'codbarras', 'codigo', 'barcode', 'barras', 'ean', 'ean13'].includes(clean)) return 'codigo_barras';
    if (['nombre', 'producto', 'descripcion', 'nombreproducto', 'item'].includes(clean)) return 'nombre';
    if (['categoria', 'rubro', 'departamento', 'seccion'].includes(clean)) return 'categoria';
    if (['unidadmedida', 'unidad', 'um', 'medida'].includes(clean)) return 'unidad_medida';
    if (['precioventa', 'precio', 'preciounitario', 'pvp'].includes(clean)) return 'precio_venta';
    if (['costo', 'costounitario', 'preciocosto', 'compra'].includes(clean)) return 'costo_unitario';
    if (['stock', 'stockinicial', 'cantidad', 'cant', 'existencias', 'unidades'].includes(clean)) return 'stock';
    if (['stockminimo', 'minimo', 'stockmin'].includes(clean)) return 'stock_minimo';
    return clean;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          setParsedRows([{
            status: 'error',
            rowNum: 1,
            errors: ['El archivo está vacío o no contiene filas de datos.'],
            data: {}
          }]);
          setIsProcessing(false);
          return;
        }

        const seenFileBarcodes = new Map(); // barcode -> rowNum
        const existingBarcodeMap = new Map();
        existingProducts.forEach((p) => {
          if (p.codigo_barras && String(p.codigo_barras).trim()) {
            existingBarcodeMap.set(String(p.codigo_barras).trim().toLowerCase(), p);
          }
        });

        const rowsProcessed = [];

        rawJson.forEach((row, index) => {
          const rowNum = index + 2;
          const normalized = {};

          Object.entries(row).forEach(([k, v]) => {
            const normKey = normalizeKey(k);
            normalized[normKey] = v;
          });

          const rowErrors = [];
          const rawNombre = String(normalized.nombre || '').trim();
          if (!rawNombre) {
            rowErrors.push('Falta el nombre del producto.');
          }

          const rawPrecio = parseFloat(String(normalized.precio_venta || '').replace(/[^0-9.]/g, ''));
          if (isNaN(rawPrecio) || rawPrecio <= 0) {
            rowErrors.push('El precio debe ser un número positivo.');
          }

          const rawCosto = parseFloat(String(normalized.costo_unitario || '0').replace(/[^0-9.]/g, '')) || 0;

          // Unidad de medida
          let rawUnidad = String(normalized.unidad_medida || 'und').toLowerCase().trim();
          const matchedUnit = UNIDADES_MEDIDA.find((u) => u.id === rawUnidad || u.short === rawUnidad);
          const finalUnidad = matchedUnit ? matchedUnit.id : 'und';
          const isDecimal = ['kg', 'g', 'l', 'ml'].includes(finalUnidad);

          const rawStock = parseFloat(String(normalized.stock || 0).replace(/[^0-9.-]/g, '')) || 0;
          const finalStock = isDecimal ? Math.round(rawStock * 1000) / 1000 : Math.floor(rawStock);

          const rawMinimo = parseFloat(String(normalized.stock_minimo || 5).replace(/[^0-9.-]/g, '')) || 5;
          const finalMinimo = isDecimal ? Math.round(rawMinimo * 1000) / 1000 : Math.floor(rawMinimo);

          const rawCodigo = String(normalized.codigo_barras || '').trim();
          const rawCat = String(normalized.categoria || 'General').trim() || 'General';

          let status = 'valid';
          let warningNote = null;

          // Verificación de duplicados en el archivo o catálogo
          if (rawCodigo) {
            const lowerCode = rawCodigo.toLowerCase();
            if (seenFileBarcodes.has(lowerCode)) {
              status = 'duplicate';
              warningNote = `Código repetido en fila ${seenFileBarcodes.get(lowerCode)}.`;
            } else {
              seenFileBarcodes.set(lowerCode, rowNum);
            }

            if (existingBarcodeMap.has(lowerCode)) {
              status = 'duplicate';
              const existingProd = existingBarcodeMap.get(lowerCode);
              warningNote = `Coincide con producto ya existente: "${existingProd.nombre}".`;
            }
          }

          if (rowErrors.length > 0) {
            status = 'error';
          }

          rowsProcessed.push({
            rowNum,
            status,
            errors: rowErrors,
            warningNote,
            data: {
              id: Date.now() + Math.random(),
              nombre: rawNombre,
              categoria: rawCat,
              unidad_medida: finalUnidad,
              precio_venta: Number((rawPrecio || 0).toFixed(2)),
              costo_unitario: Number(rawCosto.toFixed(2)),
              stock: Math.max(0, finalStock),
              stock_minimo: Math.max(0, finalMinimo),
              codigo_barras: rawCodigo,
              activo: true
            }
          });
        });

        setParsedRows(rowsProcessed);
      } catch (err) {
        console.error('Error al procesar archivo:', err);
        setParsedRows([{
          status: 'error',
          rowNum: 1,
          errors: ['Error al leer el archivo. Sube un archivo .xlsx o .csv válido.'],
          data: {}
        }]);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Contadores
  const validCount = parsedRows.filter((r) => r.status === 'valid').length;
  const duplicateCount = parsedRows.filter((r) => r.status === 'duplicate').length;
  const errorCount = parsedRows.filter((r) => r.status === 'error').length;

  const filteredPreview = parsedRows.filter((r) => {
    if (previewFilter === 'validos') return r.status === 'valid';
    if (previewFilter === 'duplicados') return r.status === 'duplicate';
    if (previewFilter === 'errores') return r.status === 'error';
    return true;
  });

  const handleConfirmImport = () => {
    // Si se activó actualizar existentes, se incluyen duplicados pero marcados
    const itemsToImport = parsedRows
      .filter((r) => r.status === 'valid' || (updateExistingStock && r.status === 'duplicate'))
      .map((r) => ({
        ...r.data,
        _esDuplicado: r.status === 'duplicate'
      }));

    if (itemsToImport.length === 0) return;
    onImportProducts(itemsToImport);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importar Inventario desde Excel / CSV" maxWidth={720}>
      <p className="hint" style={{ marginTop: 0, marginBottom: '14px', fontSize: '13px' }}>
        Carga o actualiza cientos de productos de una sola vez. Con control de <b>códigos duplicados</b> y vista previa de validación.
      </p>

      {/* Descarga de plantilla */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'var(--fog)',
          borderRadius: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div>
          <b style={{ fontSize: '13px', display: 'block' }}>¿Necesitas el formato oficial?</b>
          <span className="hint" style={{ fontSize: '12px' }}>
            Incluye columnas de unidades (kg, l, und), costo, precio y código de barras:
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn o s"
            style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', minHeight: '34px' }}
            onClick={() => handleDownloadTemplate('xlsx')}
          >
            <IconDownload size={13} />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            className="btn o s"
            style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', minHeight: '34px' }}
            onClick={() => handleDownloadTemplate('csv')}
          >
            <IconDownload size={13} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Zona de subida de archivo */}
      <div
        style={{
          border: '2px dashed var(--mist)',
          borderRadius: '12px',
          padding: '20px 16px',
          textAlign: 'center',
          background: 'var(--paper)',
          marginBottom: '16px'
        }}
      >
        <IconUpload size={28} />
        <h3 style={{ margin: '6px 0 4px', fontSize: '15px' }}>
          {fileName ? `Archivo: ${fileName}` : 'Selecciona tu archivo Excel o CSV'}
        </h3>
        <p className="hint" style={{ margin: '0 0 10px', fontSize: '12px' }}>
          Asegúrate de que los códigos de barra sean únicos por tienda.
        </p>

        <label className="btn p s" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', minHeight: '38px' }}>
          <span>{fileName ? 'Cambiar archivo' : 'Elegir archivo Excel / CSV'}</span>
          <input
            type="file"
            accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {isProcessing && (
        <div style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: 'var(--graphite)' }}>
          ⏳ Analizando y detectando duplicados...
        </div>
      )}

      {/* Resumen y Vista Previa Interactiva */}
      {parsedRows.length > 0 && !isProcessing && (
        <div style={{ marginBottom: '16px' }}>
          {/* Métricas del análisis */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button
              type="button"
              className="pill"
              aria-pressed={previewFilter === 'todos'}
              onClick={() => setPreviewFilter('todos')}
              style={{ fontSize: '12px', minHeight: '36px' }}
            >
              Todos ({parsedRows.length})
            </button>
            <button
              type="button"
              className="pill"
              aria-pressed={previewFilter === 'validos'}
              onClick={() => setPreviewFilter('validos')}
              style={{ fontSize: '12px', minHeight: '36px', color: '#15803d' }}
            >
              ✓ Listos ({validCount})
            </button>
            {duplicateCount > 0 && (
              <button
                type="button"
                className="pill"
                aria-pressed={previewFilter === 'duplicados'}
                onClick={() => setPreviewFilter('duplicados')}
                style={{ fontSize: '12px', minHeight: '36px', color: '#b45309' }}
              >
                ⚠️ Duplicados ({duplicateCount})
              </button>
            )}
            {errorCount > 0 && (
              <button
                type="button"
                className="pill"
                aria-pressed={previewFilter === 'errores'}
                onClick={() => setPreviewFilter('errores')}
                style={{ fontSize: '12px', minHeight: '36px', color: '#dc2626' }}
              >
                ⛔ Errores ({errorCount})
              </button>
            )}
          </div>

          {/* Opción para duplicados */}
          {duplicateCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                marginBottom: '12px',
                fontSize: '12px'
              }}
            >
              <input
                type="checkbox"
                id="update-dup-chk"
                checked={updateExistingStock}
                onChange={(e) => setUpdateExistingStock(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="update-dup-chk" style={{ margin: 0, cursor: 'pointer', color: '#78350f' }}>
                <b>Actualizar inventario de productos existentes</b> si se detecta el mismo código de barras (si se desmarca, se omitirán para evitar duplicados).
              </label>
            </div>
          )}

          {/* Tabla de vista previa */}
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid var(--mist)',
              borderRadius: '8px',
              fontSize: '12px'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--fog)', borderBottom: '1px solid var(--mist)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '8px' }}>Fila</th>
                  <th style={{ padding: '8px' }}>Estado</th>
                  <th style={{ padding: '8px' }}>Producto</th>
                  <th style={{ padding: '8px' }}>Unidad</th>
                  <th style={{ padding: '8px' }}>Precio</th>
                  <th style={{ padding: '8px' }}>Stock</th>
                  <th style={{ padding: '8px' }}>Código</th>
                </tr>
              </thead>
              <tbody>
                {filteredPreview.map((r, idx) => {
                  const isErr = r.status === 'error';
                  const isDup = r.status === 'duplicate';
                  const rowBg = isErr ? 'rgba(239, 68, 68, 0.08)' : isDup ? 'rgba(245, 158, 11, 0.08)' : 'transparent';

                  return (
                    <tr key={idx} style={{ background: rowBg, borderBottom: '1px solid var(--mist)' }}>
                      <td style={{ padding: '6px 8px', color: 'var(--pewter)' }}>#{r.rowNum}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {isErr ? (
                          <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⛔ Error</span>
                        ) : isDup ? (
                          <span style={{ color: '#d97706', fontWeight: 'bold' }}>⚠️ Duplicado</span>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Válido</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px', fontWeight: '500' }}>
                        {r.data.nombre || <i style={{ color: '#dc2626' }}>Sin nombre</i>}
                        {(r.warningNote || r.errors.length > 0) && (
                          <small style={{ display: 'block', color: isErr ? '#dc2626' : '#b45309', fontSize: '11px' }}>
                            {r.errors.join(', ') || r.warningNote}
                          </small>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{r.data.unidad_medida || 'und'}</td>
                      <td style={{ padding: '6px 8px' }}>{money(r.data.precio_venta || 0)}</td>
                      <td style={{ padding: '6px 8px' }}>{r.data.stock}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.data.codigo_barras || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="acts" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button
          type="button"
          className="btn p"
          style={{ flex: 1, minHeight: '44px' }}
          disabled={validCount === 0 && (!updateExistingStock || duplicateCount === 0) || isProcessing}
          onClick={handleConfirmImport}
        >
          Confirmar e Importar ({validCount + (updateExistingStock ? duplicateCount : 0)} productos)
        </button>
        <button type="button" className="btn o" onClick={onClose} style={{ minHeight: '44px' }}>
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
