import { useCallback, useEffect, useState } from 'react';
import { useAlCambiar } from './useAlCambiar';

/**
 * ¿Se puede pedir? El catálogo público ya llega filtrado (no trae `activo`
 * ni `disponible`); el portal y el personal sí los traen.
 */
const sePuedePedir = (r) => r.disponible !== false && (r.disponible === true || r.activo !== false);

/**
 * Medidas (referencias) que muestra la página de detalle de un producto.
 *
 *   useMedidasDeProducto(productosService, { modeloId })    → las medidas del modelo
 *   useMedidasDeProducto(productosService, { productoId })  → una llanta reencauchada (unidad única)
 *
 * `servicio.deModelo(id)` o `servicio.unidad(id)` las traen; solo se usan las
 * que se pueden pedir. Se vuelven a pedir cuando la API avisa un cambio.
 */
export function useMedidasDeProducto(servicio, { modeloId, productoId }) {
  const [referencias, setReferencias] = useState([]);
  // Lo que ya llegó: mientras no sea lo que se pide, se está cargando
  const [cargadoDe, setCargadoDe] = useState(null);
  const [error, setError] = useState('');
  const clave = productoId ? `u${productoId}` : `m${modeloId}`;

  const pedir = useCallback(async () => {
    const filas = productoId ? await servicio.unidad(productoId) : await servicio.deModelo(modeloId);
    // La reencauchada tiene su propia página: no se mezcla con las medidas del modelo
    return filas.filter((r) => sePuedePedir(r) && (productoId ? r.reencauchada : !r.reencauchada));
  }, [servicio, modeloId, productoId]);

  const recargar = useCallback(async () => {
    try {
      setReferencias(await pedir());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [pedir]);

  useEffect(() => {
    let vigente = true;
    pedir()
      .then((filas) => {
        if (!vigente) return;
        setReferencias(filas);
        setError('');
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargadoDe(clave));
    return () => {
      vigente = false;
    };
  }, [pedir, clave]);

  useAlCambiar(recargar);

  const cargando = cargadoDe !== clave;
  // Al pasar a otro producto no se muestran los datos del anterior
  return { referencias: cargando ? [] : referencias, cargando, error };
}
