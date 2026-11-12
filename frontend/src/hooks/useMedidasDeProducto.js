import { useCallback, useEffect, useState } from 'react';
import { useAlCambiar } from './useAlCambiar';

/**
 * Lo que se puede pedir. El catálogo público ya llega filtrado (no trae
 * `activo` ni `disponible`); el portal y el personal sí los traen.
 */
const sePuedePedir = (r) => !r.reencauchada && r.disponible !== false && (r.disponible === true || r.activo !== false);

/**
 * Medidas (referencias) de un producto para su página de detalle.
 *
 *   const { referencias, cargando, error } = useMedidasDeProducto(productosService, modeloId);
 *
 * `servicio.deModelo(id)` las trae; solo se usan las que se pueden pedir.
 * Se vuelven a pedir cuando la API avisa un cambio (tiempo real).
 */
export function useMedidasDeProducto(servicio, modeloId) {
  const [referencias, setReferencias] = useState([]);
  // Producto del que ya llegaron los datos: mientras no sea este, se está cargando
  const [cargadoDe, setCargadoDe] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const filas = await servicio.deModelo(modeloId);
      setReferencias(filas.filter(sePuedePedir));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [servicio, modeloId]);

  useEffect(() => {
    let vigente = true;
    servicio
      .deModelo(modeloId)
      .then((filas) => {
        if (!vigente) return;
        setReferencias(filas.filter(sePuedePedir));
        setError('');
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargadoDe(modeloId));
    return () => {
      vigente = false;
    };
  }, [servicio, modeloId]);

  useAlCambiar(cargar);

  const cargando = cargadoDe !== modeloId;
  // Al pasar a otro producto no se muestran las medidas del anterior
  return { referencias: cargando ? [] : referencias, cargando, error };
}
