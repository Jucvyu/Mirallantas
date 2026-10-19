import { useCallback, useEffect, useState } from 'react';

/**
 * Conecta una pantalla con un servicio: carga su listado y ofrece las
 * operaciones para modificarlo.
 *
 *   const clientes = useRecurso(clientesService);
 *   clientes.filas      → registros ya en formato de pantalla
 *   clientes.cargando   → true mientras llegan los datos
 *   clientes.error      → mensaje si la carga falló
 *   clientes.crear(valores, contexto)        → servicio.crear(...) y recarga
 *   clientes.editar(fila, valores, contexto) → servicio.editar(...) y recarga
 *   clientes.eliminar(fila)                  → servicio.eliminar(...) y recarga
 *   clientes.ejecutar(() => servicio.algo()) → cualquier operación y recarga
 *   clientes.recargar()                      → vuelve a pedir el listado
 *
 * Después de cada cambio se vuelve a pedir el listado, así la tabla
 * siempre muestra lo que de verdad quedó guardado en el servidor.
 *
 * ⚠️ El servicio debe ser uno de los objetos de src/services (son fijos):
 * si se creara uno nuevo en cada render, el listado se pediría sin parar.
 */
export function useRecurso(servicio) {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Primera carga. `vigente` evita guardar una respuesta que llega cuando
  // el componente ya se cerró.
  useEffect(() => {
    let vigente = true;
    servicio
      .listar()
      .then((datos) => {
        if (!vigente) return;
        setFilas(datos);
        setError('');
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [servicio]);

  /** Vuelve a pedir el listado (después de guardar algo). */
  const recargar = useCallback(async () => {
    try {
      setFilas(await servicio.listar());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [servicio]);

  /** Ejecuta una operación del servicio y luego recarga el listado. */
  const ejecutar = async (operacion) => {
    const resultado = await operacion();
    await recargar();
    return resultado;
  };

  return {
    filas,
    cargando,
    error,
    recargar,
    ejecutar,
    crear: (...argumentos) => ejecutar(() => servicio.crear(...argumentos)),
    editar: (...argumentos) => ejecutar(() => servicio.editar(...argumentos)),
    eliminar: (...argumentos) => ejecutar(() => servicio.eliminar(...argumentos)),
  };
}
