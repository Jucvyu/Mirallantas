import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

let servicioSeq = 0;

/** Cantidad máxima de una llanta en la solicitud (la API también la limita). */
export const CANTIDAD_MAXIMA = 999;

/** Deja la cantidad entre 1 y 999 (vacía o inválida queda en 1). */
const acotar = (n) => Math.min(CANTIDAD_MAXIMA, Math.max(1, Math.floor(Number(n) || 1)));

/**
 * Carro de la solicitud de cotización en curso.
 *
 *   - `productos`: llantas con la cantidad que necesita el cliente
 *   - `servicios`: reencauches con la foto y la descripción de la carcasa
 *
 * No guarda precios, subtotales ni stock: el precio definitivo lo confirma
 * un asesor con el proveedor después de recibir la solicitud. Una llanta
 * que ya está en el carro suma cantidad en vez de repetirse.
 *
 * Vive en el ClientLayout, así que sobrevive mientras el cliente navega
 * entre el catálogo y el resto del portal.
 */
export function CartProvider({ children }) {
  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);

  const addProducto = useCallback((producto, cantidad = 1) => {
    setProductos((prev) => {
      const encontrado = prev.find((p) => p.id === producto.id);
      if (encontrado) {
        return prev.map((p) => (p.id === producto.id ? { ...p, cantidad: acotar(p.cantidad + cantidad) } : p));
      }
      return [
        ...prev,
        {
          id: producto.id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          marca: producto.marca,
          medidas: producto.medidas,
          categoria: producto.categoria,
          foto: producto.foto,
          cantidad: acotar(cantidad),
        },
      ];
    });
  }, []);

  const setCantidad = useCallback((id, cantidad) => {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, cantidad: acotar(cantidad) } : p)));
  }, []);

  const removeProducto = useCallback((id) => {
    setProductos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addServicio = useCallback((servicio) => {
    servicioSeq += 1;
    setServicios((prev) => [...prev, { ...servicio, id: `SRVL-${servicioSeq}` }]);
  }, []);

  /** Cambia los datos de un servicio ya agregado (se edita desde el carro). */
  const updateServicio = useCallback((id, cambios) => {
    setServicios((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
  }, []);

  const removeServicio = useCallback((id) => {
    setServicios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clear = useCallback(() => {
    setProductos([]);
    setServicios([]);
  }, []);

  const value = useMemo(
    () => ({
      productos,
      servicios,
      addProducto,
      setCantidad,
      removeProducto,
      addServicio,
      updateServicio,
      removeServicio,
      clear,
      count: productos.length + servicios.length,
      unidades:
        productos.reduce((acc, p) => acc + p.cantidad, 0) + servicios.reduce((acc, s) => acc + s.cantidad, 0),
    }),
    [productos, servicios, addProducto, setCantidad, removeProducto, addServicio, updateServicio, removeServicio, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de un <CartProvider>');
  return ctx;
}
