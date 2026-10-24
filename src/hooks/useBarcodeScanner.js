import { useEffect, useRef } from 'react';

/**
 * Hook para capturar lecturas de pistolas de código de barras USB / Bluetooth
 * Las pistolas emulan un teclado ultrarrápido (< 50ms entre caracteres) terminado en 'Enter'.
 *
 * @param {object} options
 * @param {function} options.onScan - Función llamada con el código de barras leído
 * @param {boolean} [options.enabled=true] - Si el listener está activo
 * @param {number} [options.maxIntervalMs=65] - Intervalo máximo entre teclas para considerarlo escáner
 * @param {number} [options.minLength=3] - Longitud mínima del código
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  maxIntervalMs = 65,
  minLength = 3
}) {
  const bufferRef = useRef([]);
  const lastTimeRef = useRef(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      const now = Date.now();
      const interval = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Si pasa demasiado tiempo entre caracteres (> 250ms), reiniciar el buffer (tipeo humano normal)
      if (interval > 250) {
        bufferRef.current = [];
      }

      // Si se presiona Enter: comprobar si lo que se ingresó vino a velocidad de escáner
      if (e.key === 'Enter') {
        const buffer = bufferRef.current;
        if (buffer.length >= minLength) {
          // Calcular el promedio de tiempo entre teclas
          const totalDuration = now - buffer[0].time;
          const avgInterval = totalDuration / buffer.length;

          // Si el promedio es menor a maxIntervalMs, fue un escáner de hardware
          if (avgInterval <= maxIntervalMs) {
            const barcode = buffer.map((item) => item.char).join('').trim();
            if (barcode.length >= minLength) {
              e.preventDefault();
              e.stopPropagation();
              if (onScanRef.current) {
                onScanRef.current(barcode);
              }
              bufferRef.current = [];
              return;
            }
          }
        }
        bufferRef.current = [];
        return;
      }

      // Solo acumular caracteres imprimibles (alfanuméricos y signos habituales)
      if (e.key && e.key.length === 1) {
        // Si el usuario está escribiendo lentamente en un input, buffer se limpia con el timeout
        bufferRef.current.push({ char: e.key, time: now });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, maxIntervalMs, minLength]);
}
