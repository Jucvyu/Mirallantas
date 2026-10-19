import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

let servicioSeq = 0;

/**
 * Carrito de la cotización-pedido en curso.
 *
 * Refleja las dos tablas de detalle del modelo:
 *   - `productos` → detalle_venta (producto, cantidad y precio unitario)
 *   - `servicios` → detalle_servicio más la evidencia de la carcasa
 *     (foto y descripción de la llanta usada)
 *
 * Vive en el ClientLayout, así que sobrevive mientras el cliente navega
 * entre el catálogo y el resto del portal. Como los productos ya tienen
 * precio de venta, el carrito calcula el subtotal.
 */
export function CartProvider({ children }) {
  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);

  const addProducto = useCallback((producto, cantidad = 1) => {
    // No se piden más unidades de las que hay en inventario (la API lo
    // vuelve a revisar al enviar la cotización)
    const tope = (n) => (producto.stock === undefined ? n : Math.min(n, producto.stock));
    setProductos((prev) => {
      const encontrado = prev.find((p) => p.id === producto.id);
      if (encontrado) {
        return prev.map((p) => (p.id === producto.id ? { ...p, cantidad: tope(p.cantidad + cantidad) } : p));
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
          precioVenta: producto.precioVenta,
          foto: producto.foto,
          stock: producto.stock,
          cantidad: tope(cantidad),
        },
      ];
    });
  }, []);

  const setCantidad = useCallback((id, cantidad) => {
    setProductos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const pedida = Math.max(1, Number(cantidad) || 1);
        return { ...p, cantidad: p.stock === undefined ? pedida : Math.min(pedida, Math.max(p.stock, 1)) };
      }),
    );
  }, []);

  const removeProducto = useCallback((id) => {
    setProductos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addServicio = useCallback((servicio) => {
    servicioSeq += 1;
    setServicios((prev) => [...prev, { ...servicio, id: `SRVL-${servicioSeq}` }]);
  }, []);

  /** Cambia los datos de un servicio ya agregado (se edita desde el detalle). */
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

  const value = useMemo(() => {
    // Los servicios no se cobran en la cotización: el asesor les pone valor
    // después y el cliente los paga aparte. Solo suman los productos.
    const subtotalProductos = productos.reduce((acc, p) => acc + p.precioVenta * p.cantidad, 0);
    return {
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
      subtotal: subtotalProductos,
    };
  }, [productos, servicios, addProducto, setCantidad, removeProducto, addServicio, updateServicio, removeServicio, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de un <CartProvider>');
  return ctx;
}
