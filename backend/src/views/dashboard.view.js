import { enviarDato } from './respuesta.view.js';

/**
 * Vista del tablero: convierte los resultados de las consultas en la forma
 * que espera la pantalla (nombres claros y porcentajes ya calculados).
 */

/** Variación porcentual entre dos valores (null si no hay base de comparación). */
const variacion = (actual, anterior) => (anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null);

export function enviarTablero(res, { ventas, pedidos, reencauches, marcas, ultimos }) {
  const totalMarcas = marcas.reduce((suma, fila) => suma + fila.vendido, 0);

  enviarDato(res, {
    ventasMes: {
      total: ventas.total_mes,
      transacciones: ventas.transacciones,
      variacion: variacion(ventas.total_mes, ventas.total_anterior),
    },
    pedidos: {
      activos: pedidos.activos,
      enProceso: pedidos.en_proceso,
      variacion: variacion(pedidos.nuevos_mes, pedidos.nuevos_anterior),
    },
    reencauchesPorMes: reencauches,
    ventasPorMarca: marcas.map((fila) => ({
      marca: fila.marca,
      porcentaje: totalMarcas ? Math.round((fila.vendido / totalMarcas) * 100) : 0,
    })),
    ultimosPedidos: ultimos,
  });
}
