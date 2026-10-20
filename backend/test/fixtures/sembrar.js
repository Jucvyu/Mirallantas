/**
 * Datos de prueba (solo para las pruebas automáticas).
 *
 * Carga en la base desechable de las pruebas los datos de
 * fixtures/datosPrueba.js. Ya no existe un comando para cargarlos en la base
 * de desarrollo ni en la de producción: el sistema arranca vacío y solo con
 * el Administrador (ver db/crearAdmin.js).
 *
 * Reglas:
 *   · Solo corre sobre una base sin clientes, para no duplicar datos.
 *   · Los roles Administrador y Cliente y los permisos ya los crea la
 *     migración 0003; aquí solo se agregan los roles de ejemplo.
 *   · No carga la tabla `empresa`.
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';
import * as mock from './datosPrueba.js';

/** "$ 1.968.000" → 1968000 · "—" o vacío → null */
const pesos = (texto) => {
  const digitos = String(texto ?? '').replace(/\D/g, '');
  return digitos ? Number(digitos) : null;
};

/** Une listas de registros que comparten `id`, combinando sus campos. */
function unirPorId(...listas) {
  const mapa = new Map();
  for (const lista of listas) {
    for (const item of lista) mapa.set(item.id, { ...mapa.get(item.id), ...item });
  }
  return [...mapa.values()];
}

export async function sembrar(connectionString, { password }) {
  if (!password || password.length < 8) {
    throw new Error('La contraseña de prueba debe tener al menos 8 caracteres.');
  }

  const db = new pg.Client({ connectionString });
  await db.connect();

  // Inserta una fila y devuelve su id
  const insertar = async (tabla, fila) => {
    const columnas = Object.keys(fila);
    const { rows } = await db.query(
      `INSERT INTO ${tabla} (${columnas.join(', ')})
       VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING id`,
      Object.values(fila),
    );
    return rows[0].id;
  };

  // Busca un id en un mapa nombre → id y falla con un mensaje claro
  const idDe = (mapa, nombre, que) => {
    if (!nombre) return null;
    const id = mapa.get(nombre);
    if (id === undefined) throw new Error(`Datos de ejemplo: ${que} "${nombre}" no existe.`);
    return id;
  };

  try {
    await db.query('BEGIN');

    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM cliente');
    if (rows[0].n > 0) throw new Error('La base ya tiene datos: el seed solo corre sobre una base vacía.');

    // ---- Permisos y roles ----------------------------------------------
    // Los permisos y los roles del sistema ya existen (migración 0003)
    const permisos = new Map();
    for (const p of (await db.query('SELECT id, modulo FROM permiso')).rows) permisos.set(p.modulo, p.id);

    const roles = new Map();
    for (const r of (await db.query('SELECT id, nombre FROM rol')).rows) roles.set(r.nombre, r.id);

    for (const r of mock.roles) {
      if (roles.has(r.nombre)) continue;
      const id = await insertar('rol', { nombre: r.nombre, descripcion: r.descripcion, activo: r.estado === 'Activo' });
      roles.set(r.nombre, id);
      const modulos = r.permisos.split(',').map((m) => m.trim()).filter(Boolean);
      for (const modulo of modulos) {
        await db.query('INSERT INTO rol_permiso (rol_id, permiso_id) VALUES ($1, $2)', [
          id,
          idDe(permisos, modulo, 'el permiso'),
        ]);
      }
    }

    // ---- Catálogos -------------------------------------------------------
    const tiposVehiculo = new Map();
    // Los tipos de vehículo base ya los crea la migración 0005
    for (const t of (await db.query('SELECT id, nombre FROM tipo_vehiculo')).rows) tiposVehiculo.set(t.nombre, t.id);
    for (const nombre of mock.tiposVehiculo) {
      if (!tiposVehiculo.has(nombre)) tiposVehiculo.set(nombre, await insertar('tipo_vehiculo', { nombre }));
    }

    const categorias = new Map();
    for (const c of mock.categorias) {
      categorias.set(
        c.nombre,
        await insertar('categoria', { nombre: c.nombre, descripcion: c.descripcion, color: c.color, activo: c.estado === 'Activo' }),
      );
    }

    const marcas = new Map();
    for (const m of mock.marcas) marcas.set(m.nombre, await insertar('marca', { nombre: m.nombre, activo: m.estado === 'Activo' }));

    // ---- Terceros del negocio -------------------------------------------
    const clientes = new Map();
    const clientesPorCorreo = new Map();
    for (const c of mock.clientes) {
      const id = await insertar('cliente', {
        tipo_documento: c.tipoDocumento,
        numero_documento: c.numeroDocumento,
        nombre_completo: c.nombreCompleto,
        telefono: c.telefono,
        correo: c.correo,
        direccion: c.direccion,
        activo: c.estado === 'Activo',
      });
      clientes.set(c.nombreCompleto, id);
      clientesPorCorreo.set(c.correo.toLowerCase(), id);
    }

    const proveedores = new Map();
    for (const p of mock.proveedores) {
      proveedores.set(
        p.nombreRazonSocial,
        await insertar('proveedor', {
          tipo_documento: p.tipoDocumento,
          numero_documento: p.numeroDocumento,
          nombre_razon_social: p.nombreRazonSocial,
          contacto: p.contacto,
          telefono: p.telefono,
          correo: p.correo,
          direccion: p.direccion,
          activo: p.estado === 'Activo',
        }),
      );
    }

    const terceros = new Map();
    for (const t of mock.terceros) {
      terceros.set(
        t.nombreRazonSocial,
        await insertar('tercero', {
          tipo_documento: t.tipoDocumento,
          numero_documento: t.numeroDocumento,
          nombre_razon_social: t.nombreRazonSocial,
          contacto: t.contacto,
          telefono: t.telefono,
          correo: t.correo,
          direccion: t.direccion,
          activo: t.estado === 'Activo',
        }),
      );
    }

    // ---- Usuarios ---------------------------------------------------------
    // Los del módulo de usuarios, más la cuenta de portal de Luis Fernando
    // Mora, que el login ya ofrece como "cliente sin crédito".
    const hash = await bcrypt.hash(password, 10);
    const perfilLuis = mock.clienteSinCredito.profile;
    const cuentas = [
      ...mock.usuarios,
      {
        nombre: perfilLuis.nombre,
        tipoDocumento: perfilLuis.tipoDocumento,
        numeroDocumento: perfilLuis.numeroDocumento,
        correo: perfilLuis.correo,
        telefono: perfilLuis.telefono,
        rol: 'Cliente',
        estado: 'Activo',
      },
    ];
    for (const u of cuentas) {
      await insertar('usuario', {
        nombre: u.nombre,
        tipo_documento: u.tipoDocumento,
        numero_documento: u.numeroDocumento,
        correo: u.correo,
        telefono: u.telefono,
        password_hash: hash,
        rol_id: idDe(roles, u.rol, 'el rol'),
        cliente_id: u.rol === 'Cliente' ? (clientesPorCorreo.get(u.correo.toLowerCase()) ?? null) : null,
        activo: u.estado === 'Activo',
      });
    }

    // ---- Productos y servicios ------------------------------------------
    const productos = new Map();
    for (const p of mock.productos) {
      const id = await insertar('producto', {
        codigo: p.codigo,
        nombre: p.nombre,
        descripcion: p.descripcion,
        categoria_id: idDe(categorias, p.categoria, 'la categoría'),
        marca_id: idDe(marcas, p.marca, 'la marca'),
        medidas: p.medidas,
        tipo_vehiculo_id: idDe(tiposVehiculo, p.tipoVehiculo, 'el tipo de vehículo'),
        precio_compra: p.precioCompra,
        precio_venta: p.precioVenta,
        activo: p.estado === 'Activo',
      });
      productos.set(p.nombre, id);
      for (const [orden, url] of (p.imagenes ?? []).entries()) {
        await insertar('producto_imagen', { producto_id: id, url, orden });
      }
    }

    const servicios = new Map();
    for (const s of mock.servicios) {
      servicios.set(
        s.nombre,
        await insertar('servicio', {
          nombre: s.nombre,
          descripcion: s.descripcion,
          precio: s.precio,
          garantia_dias: s.garantiaDias,
          activo: s.estado === 'Activo',
        }),
      );
    }

    // ---- Solicitudes de servicio ----------------------------------------
    const solicitudes = new Map();
    for (const s of mock.solicitudesServicio) {
      solicitudes.set(
        s.id,
        await insertar('solicitud_servicio', {
          numero: s.id,
          cliente_id: idDe(clientes, s.cliente, 'el cliente'),
          servicio_id: idDe(servicios, s.servicio, 'el servicio'),
          tercero_id: idDe(terceros, s.tercero, 'el tercero'),
          medidas: s.medidas,
          cantidad: s.cantidad,
          fecha: s.fecha,
          estado: s.estado,
          estado_evidencia: s.estadoEvidencia,
          garantia: s.garantia === 'Sí',
          tiempo_estimado: s.tiempoEstimado || null,
          descripcion: s.descripcion,
          foto_url: s.foto || null,
        }),
      );
    }

    // Línea de detalle (cotización o venta) → columnas comunes
    const lineaDetalle = (l, { conSolicitud }) => ({
      tipo: l.tipo,
      producto_id: l.tipo === 'producto' ? idDe(productos, l.nombre, 'el producto') : null,
      servicio_id: l.tipo === 'servicio' ? idDe(servicios, l.nombre, 'el servicio') : null,
      ...(conSolicitud ? { solicitud_servicio_id: l.solicitud ? (solicitudes.get(l.solicitud) ?? null) : null } : {}),
      descripcion: l.nombre,
      medida: l.medida || null,
      cantidad: l.cantidad,
      precio_unitario: pesos(l.unitario),
      subtotal: pesos(l.subtotal),
    });

    // ---- Cotizaciones-pedido ------------------------------------------------
    // Las del administrador más las de los portales de María y de Luis
    const nombreMaria = mock.clienteConCredito.profile.nombre;
    const nombreLuis = mock.clienteSinCredito.profile.nombre;
    const todasCotizaciones = unirPorId(
      mock.cotizaciones,
      mock.clienteConCredito.cotizaciones.map((c) => ({ cliente: nombreMaria, ...c })),
      mock.clienteSinCredito.cotizaciones.map((c) => ({ cliente: nombreLuis, ...c })),
    );

    /** "2026-10-01" + 8 días → "2026-10-09" (en UTC, sin desfases de zona horaria). */
    const sumarDias = (fecha, dias) => {
      const d = new Date(`${fecha}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + dias);
      return d.toISOString().slice(0, 10);
    };

    const cotizaciones = new Map();
    for (const c of todasCotizaciones) {
      const detalle = c.detalle ?? [];
      const id = await insertar('cotizacion', {
        numero: c.id,
        cliente_id: idDe(clientes, c.cliente, 'el cliente'),
        proveedor_id: idDe(proveedores, c.proveedor, 'el proveedor'),
        fecha: c.fecha,
        metodo_pago: c.metodoPago,
        plazo_dias: c.plazoDias ?? 0,
        subtotal: detalle.reduce((suma, l) => suma + (pesos(l.subtotal) ?? 0), 0),
        interes: pesos(c.interes) ?? 0,
        total: pesos(c.total) ?? 0,
        cuota_inicial: pesos(c.cuotaInicial) ?? 0,
        confirmado: c.confirmado ?? true,
        // Las cotizaciones de prueba ya están emitidas (y aceptadas: tienen método de pago)
        emitida_en: (c.confirmado ?? true) ? c.fecha : null,
        vence_en: (c.confirmado ?? true) ? sumarDias(c.fecha, 8) : null,
        estado: c.estado,
        estado_entrega: c.estadoEntrega,
        direccion_entrega: c.direccionEntrega,
        motivo_cancelacion: c.motivoCancelacion ?? null,
      });
      cotizaciones.set(c.id, id);
      for (const l of detalle) {
        await insertar('cotizacion_detalle', { cotizacion_id: id, ...lineaDetalle(l, { conSolicitud: true }) });
      }
    }

    // ---- Ventas --------------------------------------------------------------
    const ventas = new Map();
    for (const v of mock.ventas) {
      const id = await insertar('venta', {
        numero: v.id,
        cliente_id: idDe(clientes, v.cliente, 'el cliente'),
        cotizacion_id: v.cotizacion ? idDe(cotizaciones, v.cotizacion, 'la cotización') : null,
        proveedor_id: idDe(proveedores, v.proveedor, 'el proveedor'),
        tercero_id: idDe(terceros, v.tercero, 'el tercero'),
        fecha: v.fecha,
        metodo_pago: v.metodoPago,
        interes: pesos(v.interes) ?? 0,
        total: pesos(v.total),
        cuota_inicial: pesos(v.cuotaInicial) ?? 0,
        estado: v.estado,
        estado_entrega: v.estadoEntrega,
      });
      ventas.set(v.id, id);
      for (const l of v.detalle ?? []) {
        await insertar('venta_detalle', { venta_id: id, ...lineaDetalle(l, { conSolicitud: false }) });
      }
    }

    // ---- Compras ---------------------------------------------------------------
    for (const c of mock.compras) {
      const id = await insertar('compra', {
        numero: c.id,
        proveedor_id: idDe(proveedores, c.proveedor, 'el proveedor'),
        cotizacion_id: c.cotizacion ? idDe(cotizaciones, c.cotizacion, 'la cotización') : null,
        fecha: c.fecha,
        total: pesos(c.total),
        estado: c.estado,
        estado_entrega: c.estadoEntrega,
      });
      for (const l of c.detalle) {
        await insertar('compra_detalle', {
          compra_id: id,
          producto_id: idDe(productos, l.producto, 'el producto'),
          cantidad: l.cantidad,
          precio_unitario: pesos(l.unitario),
          subtotal: pesos(l.subtotal),
          origen: c.cotizacion ? 'Cotización' : 'Adicional',
        });
      }
    }

    // ---- Cartera ---------------------------------------------------------------
    const creditos = new Map();
    const todosCreditos = unirPorId(
      mock.creditos,
      mock.clienteConCredito.creditos.map((c) => ({ cliente: nombreMaria, ...c })),
    );
    for (const c of todosCreditos) {
      creditos.set(
        c.id,
        await insertar('credito', {
          numero: c.id,
          cliente_id: idDe(clientes, c.cliente, 'el cliente'),
          venta_id: c.venta ? idDe(ventas, c.venta, 'la venta') : null,
          cotizacion_id: c.cotizacion ? idDe(cotizaciones, c.cotizacion, 'la cotización') : null,
          monto_total: pesos(c.montoTotal),
          saldo_pendiente: pesos(c.saldoPendiente) ?? 0,
          plazo_dias: c.plazoDias,
          fecha_apertura: c.fechaApertura,
          fecha_limite: c.fechaLimite,
          activo: c.estado === 'Activo',
        }),
      );
    }

    for (const a of unirPorId(mock.abonos, mock.clienteConCredito.abonos)) {
      await insertar('abono', {
        numero: a.id,
        credito_id: idDe(creditos, a.credito, 'el crédito'),
        fecha: a.fecha,
        monto: pesos(a.monto),
        medio_pago: a.metodoPago,
        comprobante_url: a.comprobante || null,
        estado: a.estado,
      });
    }

    const todasSolicitudesCredito = unirPorId(
      mock.solicitudesCredito,
      mock.clienteConCredito.solicitudesCredito.map((s) => ({ cliente: nombreMaria, ...s })),
    );
    for (const s of todasSolicitudesCredito) {
      await insertar('solicitud_credito', {
        numero: s.id,
        cliente_id: idDe(clientes, s.cliente, 'el cliente'),
        monto: pesos(s.monto),
        plazo_dias: s.plazoDias,
        fecha: s.fecha,
        estado: s.estado,
        motivo: s.motivo || null,
      });
    }

    // ---- Consecutivos ----------------------------------------------------------
    // Los números nuevos continúan después de los ya cargados (PED-2024-068 →
    // el siguiente PED de 2024 sería el 069).
    await db.query(`
      INSERT INTO consecutivo (prefijo, anio, ultimo)
      SELECT partes[1], partes[2]::int, MAX(partes[3]::int)
      FROM (
        SELECT regexp_match(numero, '^([A-Z]+)-(\\d{4})-(\\d+)$') AS partes
        FROM (
          SELECT numero FROM cotizacion UNION ALL SELECT numero FROM venta
          UNION ALL SELECT numero FROM compra
        ) documentos
      ) t
      WHERE partes IS NOT NULL
      GROUP BY partes[1], partes[2]
    `);

    await db.query('COMMIT');
    return { cuentas: cuentas.map((u) => ({ correo: u.correo, rol: u.rol })) };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
