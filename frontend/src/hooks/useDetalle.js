import { useEffect, useState } from 'react';

/**
 * Completa un documento con sus líneas de detalle.
 *
 * Los listados traen solo la cabecera (cliente, fecha, total…). Cuando se
 * abre el detalle o el comprobante hacen falta las líneas: si el documento
 * ya las trae (como en el portal) se usan; si no, se piden al `servicio`
 * del documento (por ejemplo ventasService.obtener).
 *
 *   const { documento, cargando, error } = useDetalle(fila, ventasService);
 */
export function useDetalle(inicial, servicio) {
  const yaTieneDetalle = Array.isArray(inicial?.detalle);
  const [documento, setDocumento] = useState(inicial);
  const [cargando, setCargando] = useState(!yaTieneDetalle);
  const [error, setError] = useState('');
  const id = inicial?.id;

  useEffect(() => {
    if (yaTieneDetalle || !servicio) return undefined;
    let vigente = true;
    servicio
      .obtener(id)
      .then((completo) => vigente && setDocumento(completo))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [yaTieneDetalle, servicio, id]);

  return { documento, cargando, error };
}
