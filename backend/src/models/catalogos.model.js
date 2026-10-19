import { query } from '../db.js';

/**
 * Modelo genérico para los catálogos simples: tablas sin detalle que solo
 * se listan, crean, editan, activan/desactivan y eliminan.
 *
 * `crearModeloCatalogo` recibe la descripción de la tabla y devuelve las
 * funciones SQL para ella. Así las siete tablas de catálogo comparten el
 * mismo código.
 *
 * definicion:
 *   tabla       nombre de la tabla
 *   campos      { campoApi: 'columna_sql' } que se leen y escriben
 *   buscarEn    columnas donde busca `q`
 *   ordenarPor  columna de orden del listado
 *   conActivo   la tabla tiene columna `activo` (por defecto true)
 */
export function crearModeloCatalogo({ tabla, campos, buscarEn, ordenarPor, conActivo = true }) {
  // Columnas que se devuelven, con su nombre camelCase de la API
  const seleccion = ['id', ...Object.entries(campos).map(([api, col]) => `${col} AS "${api}"`)]
    .concat(conActivo ? ['activo'] : [])
    .join(', ');

  /** { campoApi: valor } → [[columna, valor], …] solo con lo que llegó */
  const aColumnas = (datos) =>
    Object.entries(datos)
      .filter(([api, valor]) => valor !== undefined && (api in campos || (conActivo && api === 'activo')))
      .map(([api, valor]) => [api === 'activo' ? 'activo' : campos[api], valor]);

  /** Un registro por id, o null. */
  async function buscarPorId(id) {
    const { rows } = await query(`SELECT ${seleccion} FROM ${tabla} WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  return {
    conActivo,
    buscarPorId,

    /** Listado con búsqueda, filtro por activo y paginación → { filas, total } */
    async listar({ q, pagina, porPagina, activo }) {
      const condiciones = [];
      const valores = [];
      if (q) {
        valores.push(`%${q}%`);
        condiciones.push(`(${buscarEn.map((c) => `${c} ILIKE $${valores.length}`).join(' OR ')})`);
      }
      if (activo !== undefined && conActivo) {
        valores.push(activo);
        condiciones.push(`activo = $${valores.length}`);
      }
      const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

      const total = await query(`SELECT COUNT(*)::int AS n FROM ${tabla} ${where}`, valores);
      const { rows } = await query(
        `SELECT ${seleccion} FROM ${tabla} ${where}
          ORDER BY ${ordenarPor}, id
          LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
        [...valores, porPagina, (pagina - 1) * porPagina],
      );
      return { filas: rows, total: total.rows[0].n };
    },

    /** Inserta y devuelve el registro creado. */
    async crear(datos) {
      const pares = aColumnas(datos);
      const { rows } = await query(
        `INSERT INTO ${tabla} (${pares.map(([c]) => c).join(', ')})
         VALUES (${pares.map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING ${seleccion}`,
        pares.map(([, v]) => v),
      );
      return rows[0];
    },

    /** Actualiza solo lo que llegó; devuelve el registro (o null si no existe). */
    async actualizar(id, datos) {
      const pares = aColumnas(datos);
      if (pares.length === 0) return buscarPorId(id);
      const { rows } = await query(
        `UPDATE ${tabla} SET ${pares.map(([c], i) => `${c} = $${i + 1}`).join(', ')}
          WHERE id = $${pares.length + 1}
          RETURNING ${seleccion}`,
        [...pares.map(([, v]) => v), id],
      );
      return rows[0] ?? null;
    },

    /** Activa o desactiva; devuelve el registro (o null si no existe). */
    async cambiarActivo(id, activo) {
      const { rows } = await query(`UPDATE ${tabla} SET activo = $1 WHERE id = $2 RETURNING ${seleccion}`, [activo, id]);
      return rows[0] ?? null;
    },

    /** Elimina; devuelve true si existía. Si otros registros dependen de él, la base lo impide (409). */
    async eliminar(id) {
      const { rowCount } = await query(`DELETE FROM ${tabla} WHERE id = $1`, [id]);
      return rowCount > 0;
    },
  };
}

// ---- Las siete tablas de catálogo --------------------------------------------

/** Campos comunes de proveedores y terceros (reencauchadoras). */
const CAMPOS_EMPRESA_EXTERNA = {
  tipoDocumento: 'tipo_documento',
  numeroDocumento: 'numero_documento',
  nombreRazonSocial: 'nombre_razon_social',
  contacto: 'contacto',
  telefono: 'telefono',
  correo: 'correo',
  direccion: 'direccion',
};

export const categorias = crearModeloCatalogo({
  tabla: 'categoria',
  campos: { nombre: 'nombre', descripcion: 'descripcion', color: 'color' },
  buscarEn: ['nombre', 'descripcion'],
  ordenarPor: 'nombre',
});

export const marcas = crearModeloCatalogo({
  tabla: 'marca',
  campos: { nombre: 'nombre' },
  buscarEn: ['nombre'],
  ordenarPor: 'nombre',
});

export const tiposVehiculo = crearModeloCatalogo({
  tabla: 'tipo_vehiculo',
  campos: { nombre: 'nombre' },
  buscarEn: ['nombre'],
  ordenarPor: 'nombre',
  conActivo: false,
});

export const servicios = crearModeloCatalogo({
  tabla: 'servicio',
  campos: { nombre: 'nombre', descripcion: 'descripcion', precio: 'precio', garantiaDias: 'garantia_dias' },
  buscarEn: ['nombre', 'descripcion'],
  ordenarPor: 'nombre',
});

export const clientes = crearModeloCatalogo({
  tabla: 'cliente',
  campos: {
    tipoDocumento: 'tipo_documento',
    numeroDocumento: 'numero_documento',
    nombreCompleto: 'nombre_completo',
    telefono: 'telefono',
    correo: 'correo',
    direccion: 'direccion',
  },
  buscarEn: ['nombre_completo', 'numero_documento', 'correo'],
  ordenarPor: 'nombre_completo',
});

export const proveedores = crearModeloCatalogo({
  tabla: 'proveedor',
  campos: CAMPOS_EMPRESA_EXTERNA,
  buscarEn: ['nombre_razon_social', 'numero_documento', 'contacto'],
  ordenarPor: 'nombre_razon_social',
});

export const terceros = crearModeloCatalogo({
  tabla: 'tercero',
  campos: CAMPOS_EMPRESA_EXTERNA,
  buscarEn: ['nombre_razon_social', 'numero_documento', 'contacto'],
  ordenarPor: 'nombre_razon_social',
});
