// =========================================================================
// Datos de ejemplo de MiraLlantas (SOLO DESARROLLO).
//
// Son los mismos datos con los que nació el prototipo del frontend. Ahora
// solo los usa `npm run seed` para llenar una base de datos de desarrollo
// vacía: la aplicación ya no lee nada de aquí, todo sale de la API.
//
// No los uses en producción ni los tomes como datos reales de la empresa.
// =========================================================================

// -------------------------------------------------------------------------
// Catálogos transversales
// -------------------------------------------------------------------------

export const tiposDocumento = ['CC', 'CE', 'NIT', 'Pasaporte'];

/** Forma en que se pacta el pago de una venta (ficha: contado o crédito). */
export const metodosPago = ['Contado', 'Crédito'];

/** Medio concreto con el que el cliente paga un abono. */
export const mediosPago = ['Efectivo', 'Transferencia', 'Tarjeta'];

/** Plazos fijos de financiación que maneja la empresa. */
export const PLAZOS_CREDITO = [30, 60, 90];

/** Interés que se suma al total de la venta según el plazo pactado. */
export const INTERES_POR_PLAZO = { 30: 0.03, 60: 0.06, 90: 0.09 };

/** Porcentaje de cuota inicial exigido cuando la venta es a crédito. */
export const CUOTA_INICIAL_CREDITO = 0.5;

/** Cupo de cartera de cada cliente: baja al abrir créditos y sube al abonar. */
export const CUPO_CARTERA = 2000000;

export const tiposVehiculo = [
  'Turismo',
  'SUV / Camioneta',
  'Carga liviana',
  'Camión / Tracto',
  'Agrícola',
  'Industrial',
];

/** Datos de MiraLlantas que encabezan el comprobante de venta. */
export const empresa = {
  nombre: 'MiraLlantas',
  razonSocial: 'MiraLlantas S.A.S.',
  nit: '901.456.789-2',
  direccion: 'Calle 34 #81-27, Medellín',
  telefono: '+57 310 897 69 43',
  correo: 'contabilidadmirallantas@gmail.com',
  ciudad: 'Medellín, Antioquia · Colombia',
};

// -------------------------------------------------------------------------
// Estados
//
// En el modelo, las tablas de catálogo (categoria, producto, proveedor,
// tercero, cliente, servicio, imagen, credito) guardan el estado como
// TINYINT(1), así que en el front son un interruptor Activo/Inactivo. Las
// tablas de operación (venta, compra) lo guardan como texto y tienen su
// propio flujo.
// -------------------------------------------------------------------------

export const estadosActivo = ['Activo', 'Inactivo'];

/** Flujo de la cotización-pedido, desde que el cliente la envía. */
export const estadosCotizacion = ['Pendiente', 'Aprobada', 'En proceso', 'Completada', 'Rechazada'];

export const FLUJO_ESTADOS_COTIZACION = {
  Pendiente: ['Aprobada', 'Rechazada'],
  Aprobada: ['En proceso', 'Rechazada'],
  'En proceso': ['Completada'],
  Completada: [],
  Rechazada: [],
};

/** Al llegar a este estado, la cotización genera la venta automáticamente. */
export const ESTADO_COTIZACION_COMPLETADA = 'Completada';

export const estadosVenta = ['Pendiente', 'Completada', 'Anulada'];

export const FLUJO_ESTADOS_VENTA = {
  Pendiente: ['Completada', 'Anulada'],
  Completada: ['Anulada'],
  Anulada: [],
};

export const estadosCompra = ['Pendiente', 'Recibida', 'Anulada'];

export const FLUJO_ESTADOS_COMPRA = {
  Pendiente: ['Recibida', 'Anulada'],
  Recibida: [],
  Anulada: [],
};

/**
 * Estado de entrega. Ya no es un módulo aparte: vive dentro de la
 * cotización-pedido (despacho al cliente) y dentro de la compra
 * (recepción de la mercancía del proveedor).
 */
export const estadosEntrega = ['Pendiente', 'En camino', 'Entregado', 'Cancelado'];

export const FLUJO_ESTADOS_ENTREGA = {
  Pendiente: ['En camino', 'Cancelado'],
  'En camino': ['Entregado', 'Cancelado'],
  Entregado: [],
  Cancelado: [],
};

/** Solicitud de servicio de reencauche (ficha: proceso de servicios). */
export const estadosServicio = ['Pendiente', 'En proceso', 'Completado', 'Cancelado'];

export const FLUJO_ESTADOS_SERVICIO = {
  Pendiente: ['En proceso', 'Cancelado'],
  'En proceso': ['Completado', 'Cancelado'],
  Completado: [],
  Cancelado: [],
};

/** Revisión de la carcasa que hace la reencauchadora antes de aceptarla. */
export const estadosEvidenciaCarcasa = ['Pendiente de revisión', 'Apta', 'No apta'];

export const estadosAbono = ['Pendiente', 'Confirmado', 'Rechazado'];

/** Un abono nunca vuelve a "Pendiente" ni cambia de confirmado a rechazado. */
export const FLUJO_ESTADOS_ABONO = {
  Pendiente: ['Confirmado', 'Rechazado'],
  Confirmado: [],
  Rechazado: [],
};

export const estadosSolicitudCredito = ['Pendiente', 'Aprobada', 'Rechazada'];

export const FLUJO_ESTADOS_SOLICITUD_CREDITO = {
  Pendiente: ['Aprobada', 'Rechazada'],
  Aprobada: [],
  Rechazada: [],
};

// -------------------------------------------------------------------------
// Configuración: roles, permisos y usuarios
// (sin tabla en el modelo relacional; los exige la ficha)
// -------------------------------------------------------------------------

export const modulosPermiso = [
  'Roles',
  'Usuarios',
  'Clientes',
  'Proveedores',
  'Terceros',
  'Productos',
  'Categorías',
  'Marcas',
  'Compras',
  'Pedidos-Cotización',
  'Ventas',
  'Solicitudes de servicio',
  'Cartera',
  'Abonos',
  'Dashboard',
];

export const roles = [
  { id: 'ROL001', nombre: 'Administrador', descripcion: 'Acceso completo al aplicativo.', permisos: modulosPermiso.join(', '), estado: 'Activo' },
  { id: 'ROL002', nombre: 'Asesor de ventas', descripcion: 'Ventas, cotizaciones, compras y servicios.', permisos: 'Clientes, Productos, Compras, Pedidos-Cotización, Ventas, Solicitudes de servicio', estado: 'Activo' },
  { id: 'ROL003', nombre: 'Secretaría', descripcion: 'Cartera, abonos y comprobantes.', permisos: 'Clientes, Cartera, Abonos, Ventas', estado: 'Activo' },
  { id: 'ROL004', nombre: 'Cliente', descripcion: 'Portal: catálogo, cotizaciones y cartera.', permisos: 'Pedidos-Cotización, Cartera', estado: 'Activo' },
];

export const usuarios = [
  { id: 'USU001', nombre: 'Carlos Mendoza', tipoDocumento: 'CC', numeroDocumento: '79456123', correo: 'admin@mirallantas.com', telefono: '3001112233', rol: 'Administrador', estado: 'Activo' },
  { id: 'USU002', nombre: 'Ana Ríos Salcedo', tipoDocumento: 'CC', numeroDocumento: '52678901', correo: 'ana.rios@mirallantas.com', telefono: '3112223344', rol: 'Asesor de ventas', estado: 'Activo' },
  { id: 'USU003', nombre: 'Pedro Martínez', tipoDocumento: 'CC', numeroDocumento: '80234567', correo: 'pedro.m@mirallantas.com', telefono: '3204445566', rol: 'Secretaría', estado: 'Activo' },
  { id: 'USU004', nombre: 'María García', tipoDocumento: 'CC', numeroDocumento: '1024567890', correo: 'maria@gmail.com', telefono: '3119876543', rol: 'Cliente', estado: 'Activo' },
  { id: 'USU005', nombre: 'Luis Vargas Ríos', tipoDocumento: 'CC', numeroDocumento: '19345678', correo: 'luis.v@mirallantas.com', telefono: '3056667788', rol: 'Asesor de ventas', estado: 'Inactivo' },
];

// -------------------------------------------------------------------------
// Tabla `cliente`
// -------------------------------------------------------------------------

export const clientes = [
  { id: 'CLI001', tipoDocumento: 'NIT', numeroDocumento: '900123456-1', nombreCompleto: 'Transportes Andinos SAS', telefono: '3001234567', correo: 'contacto@transportesandinos.com', direccion: 'Cra 30 #25-90, Bogotá', estado: 'Activo' },
  { id: 'CLI002', tipoDocumento: 'CC', numeroDocumento: '1024567890', nombreCompleto: 'María García Ruiz', telefono: '3119876543', correo: 'maria@gmail.com', direccion: 'Calle 50 #45-12, Medellín', estado: 'Activo' },
  { id: 'CLI003', tipoDocumento: 'NIT', numeroDocumento: '800456789-2', nombreCompleto: 'Flota Express Ltda', telefono: '3209988776', correo: 'flota@express.co', direccion: 'Av 3N #35-12, Cali', estado: 'Activo' },
  { id: 'CLI004', tipoDocumento: 'CC', numeroDocumento: '79543210', nombreCompleto: 'Carlos Arbeláez Ossa', telefono: '3145551234', correo: 'carlos.a@hotmail.com', direccion: 'Cra 15 #20-40, Barranquilla', estado: 'Activo' },
  { id: 'CLI005', tipoDocumento: 'NIT', numeroDocumento: '901234567-3', nombreCompleto: 'Servicios Terrestres SA', telefono: '3018889900', correo: 'admin@sterrestres.com.co', direccion: 'Calle 80 #50-30, Bogotá', estado: 'Activo' },
  { id: 'CLI006', tipoDocumento: 'CC', numeroDocumento: '19876543', nombreCompleto: 'Luis Fernando Mora', telefono: '3204449988', correo: 'lfmora@yahoo.com', direccion: 'Cra 5 #10-22, Pereira', estado: 'Activo' },
  { id: 'CLI007', tipoDocumento: 'NIT', numeroDocumento: '802345678-5', nombreCompleto: 'Cooperativa de Taxis Norte', telefono: '3176667788', correo: 'admin@taxinorte.coop', direccion: 'Calle 134 #19-20, Bogotá', estado: 'Activo' },
  { id: 'CLI008', tipoDocumento: 'NIT', numeroDocumento: '900987654-3', nombreCompleto: 'Inversiones Rodante SAS', telefono: '3125554433', correo: 'inv@rodante.co', direccion: 'Cra 33 #48-10, Bucaramanga', estado: 'Inactivo' },
];

// -------------------------------------------------------------------------
// Tabla `proveedor`
// -------------------------------------------------------------------------

export const proveedores = [
  { id: 'PRV001', tipoDocumento: 'NIT', numeroDocumento: '860345678-9', nombreRazonSocial: 'Michelin Colombia SAS', contacto: 'Diana Peláez', telefono: '6017891234', correo: 'ventas@michelin.co', direccion: 'Cra 7 #71-52, Bogotá', estado: 'Activo' },
  { id: 'PRV002', tipoDocumento: 'NIT', numeroDocumento: '890123456-7', nombreRazonSocial: 'Bridgestone de Colombia', contacto: 'Andrés Gil', telefono: '6015671234', correo: 'pedidos@bridgestone.co', direccion: 'Calle 26 #68-03, Bogotá', estado: 'Activo' },
  { id: 'PRV003', tipoDocumento: 'NIT', numeroDocumento: '800789012-4', nombreRazonSocial: 'Goodyear Colombia Ltda', contacto: 'Marcela Ospina', telefono: '4446789012', correo: 'goodyear@goodyear.co', direccion: 'Av El Poblado #16-28, Medellín', estado: 'Activo' },
  { id: 'PRV004', tipoDocumento: 'NIT', numeroDocumento: '901456789-1', nombreRazonSocial: 'Continental Distribuciones SA', contacto: 'Jorge Rentería', telefono: '3234561234', correo: 'ventas@contidist.com', direccion: 'Av 3N #12-34, Cali', estado: 'Activo' },
  { id: 'PRV005', tipoDocumento: 'NIT', numeroDocumento: '700234890-5', nombreRazonSocial: 'Importadora Llantas Plus', contacto: 'Sara Quintero', telefono: '6013456789', correo: 'importaciones@llantasplus.co', direccion: 'Calle 13 #23-45, Bogotá', estado: 'Inactivo' },
  { id: 'PRV006', tipoDocumento: 'NIT', numeroDocumento: '830112334-2', nombreRazonSocial: 'Pirelli Colombia', contacto: 'Felipe Duque', telefono: '6014445566', correo: 'ventas@pirelli.co', direccion: 'Cra 11 #93-45, Bogotá', estado: 'Activo' },
];

// -------------------------------------------------------------------------
// Tabla `tercero` — reencauchadoras que ejecutan el servicio
// -------------------------------------------------------------------------

export const terceros = [
  { id: 'TER001', tipoDocumento: 'NIT', numeroDocumento: '900234567-8', nombreRazonSocial: 'Reencauchadora Vulcanizadora Sur', contacto: 'Hernán Caro', telefono: '3201234567', correo: 'contacto@vulcansur.co', direccion: 'Calle 12 Sur #40-20, Medellín', estado: 'Activo' },
  { id: 'TER002', tipoDocumento: 'NIT', numeroDocumento: '800456012-3', nombreRazonSocial: 'Reencauches del Valle SAS', contacto: 'Carmen López', telefono: '4448889000', correo: 'ventas@reencauchesvalle.com', direccion: 'Calle 36 #3N-45, Cali', estado: 'Activo' },
  { id: 'TER003', tipoDocumento: 'NIT', numeroDocumento: '860003128-1', nombreRazonSocial: 'Renovadora Andina Ltda', contacto: 'Sandra Ruiz', telefono: '6013456789', correo: 'servicio@renovandina.co', direccion: 'Cra 7 #32-10, Bogotá', estado: 'Activo' },
  { id: 'TER004', tipoDocumento: 'NIT', numeroDocumento: '901778990-4', nombreRazonSocial: 'Tecnollantas Reencauche', contacto: 'Miguel Torres', telefono: '3155667788', correo: 'ops@tecnollantas.co', direccion: 'Av 68 #24-30, Bogotá', estado: 'Inactivo' },
];

// -------------------------------------------------------------------------
// Tabla `categoria`
// -------------------------------------------------------------------------

export const categorias = [
  { id: 'CAT001', nombre: 'Turismo', descripcion: 'Llantas para vehículos de pasajeros.', color: '#FBBF24', estado: 'Activo' },
  { id: 'CAT002', nombre: 'SUV / Camioneta', descripcion: 'Llantas para camionetas y todoterreno.', color: '#3B82F6', estado: 'Activo' },
  { id: 'CAT003', nombre: 'Performance', descripcion: 'Alta velocidad y agarre deportivo.', color: '#EF4444', estado: 'Activo' },
  { id: 'CAT004', nombre: 'Carga liviana', descripcion: 'Vans y camionetas de reparto.', color: '#22C55E', estado: 'Activo' },
  { id: 'CAT005', nombre: 'Camión / Tracto', descripcion: 'Transporte de carga pesada y reencauche.', color: '#A78BFA', estado: 'Activo' },
];

/**
 * Marca de la llanta. En el modelo es un texto dentro de `producto`; aquí
 * se mantiene como catálogo para poder asociarla y filtrar por ella, tal
 * como piden los casos de uso.
 */
export const marcas = [
  { id: 'MRC001', nombre: 'Michelin', estado: 'Activo' },
  { id: 'MRC002', nombre: 'Bridgestone', estado: 'Activo' },
  { id: 'MRC003', nombre: 'Goodyear', estado: 'Activo' },
  { id: 'MRC004', nombre: 'Continental', estado: 'Activo' },
  { id: 'MRC005', nombre: 'Pirelli', estado: 'Activo' },
];

// -------------------------------------------------------------------------
// Tabla `producto` (+ `imagen`)
// -------------------------------------------------------------------------

export const productos = [
  { id: 'PRD001', codigo: 'ML-19565R15', nombre: 'Michelin Energy XM2+', descripcion: 'Larga duración para uso urbano.', categoria: 'Turismo', marca: 'Michelin', medidas: '195/65R15', tipoVehiculo: 'Turismo', precioCompra: 218000, precioVenta: 280000, estado: 'Activo', imagenes: ['tire-workshop'] },
  { id: 'PRD002', codigo: 'BS-20555R16', nombre: 'Bridgestone Turanza T005', descripcion: 'Confort y frenado en mojado.', categoria: 'Turismo', marca: 'Bridgestone', medidas: '205/55R16', tipoVehiculo: 'Turismo', precioCompra: 342000, precioVenta: 447000, estado: 'Activo', imagenes: ['tire-car'] },
  { id: 'PRD003', codigo: 'GY-22545R17', nombre: 'Goodyear EfficientGrip P2', descripcion: 'Bajo consumo y buen agarre.', categoria: 'Performance', marca: 'Goodyear', medidas: '225/45R17', tipoVehiculo: 'Turismo', precioCompra: 358000, precioVenta: 471000, estado: 'Activo', imagenes: ['tire-sports'] },
  { id: 'PRD004', codigo: 'CT-21560R17', nombre: 'Continental PremiumContact 7', descripcion: 'Estabilidad en carretera.', categoria: 'SUV / Camioneta', marca: 'Continental', medidas: '215/60R17', tipoVehiculo: 'SUV / Camioneta', precioCompra: 352000, precioVenta: 465000, estado: 'Activo', imagenes: ['tire-suv'] },
  { id: 'PRD005', codigo: 'BS-25550R19', nombre: 'Bridgestone Alenza 001', descripcion: 'Silenciosa para camioneta grande.', categoria: 'SUV / Camioneta', marca: 'Bridgestone', medidas: '255/50R19', tipoVehiculo: 'SUV / Camioneta', precioCompra: 468000, precioVenta: 620000, estado: 'Activo', imagenes: ['tire-workshop'] },
  { id: 'PRD006', codigo: 'GY-26565R17', nombre: 'Goodyear Wrangler AT Silent', descripcion: 'Mixta asfalto y destapado.', categoria: 'SUV / Camioneta', marca: 'Goodyear', medidas: '265/65R17', tipoVehiculo: 'SUV / Camioneta', precioCompra: 432000, precioVenta: 575000, estado: 'Activo', imagenes: ['tire-bmw'] },
  { id: 'PRD007', codigo: 'ML-26570R16', nombre: 'Michelin LTX Force', descripcion: 'Resistente para carga liviana.', categoria: 'Carga liviana', marca: 'Michelin', medidas: '265/70R16', tipoVehiculo: 'Carga liviana', precioCompra: 378000, precioVenta: 492000, estado: 'Activo', imagenes: ['tire-truck'] },
  { id: 'PRD008', codigo: 'BS-24545R18', nombre: 'Bridgestone Potenza RE050A', descripcion: 'Deportiva de alto desempeño.', categoria: 'Performance', marca: 'Bridgestone', medidas: '245/45R18', tipoVehiculo: 'Turismo', precioCompra: 455000, precioVenta: 610000, estado: 'Activo', imagenes: ['tire-sports'] },
  { id: 'PRD009', codigo: 'CT-23565R16', nombre: 'Continental VanContact 100', descripcion: 'Para vans de reparto urbano.', categoria: 'Carga liviana', marca: 'Continental', medidas: '235/65R16', tipoVehiculo: 'Carga liviana', precioCompra: 238000, precioVenta: 315000, estado: 'Activo', imagenes: ['tire-workshop'] },
  { id: 'PRD010', codigo: 'GY-29580R225', nombre: 'Goodyear KMax D', descripcion: 'Tracción para tracto-camión.', categoria: 'Camión / Tracto', marca: 'Goodyear', medidas: '295/80R22.5', tipoVehiculo: 'Camión / Tracto', precioCompra: 960000, precioVenta: 1250000, estado: 'Activo', imagenes: ['tire-truck2'] },
  { id: 'PRD011', codigo: 'ML-22540R18', nombre: 'Michelin Pilot Sport 5', descripcion: 'Máximo agarre en seco y mojado.', categoria: 'Performance', marca: 'Michelin', medidas: '225/40R18', tipoVehiculo: 'Turismo', precioCompra: 548000, precioVenta: 720000, estado: 'Inactivo', imagenes: ['tire-bmw'] },
];

// -------------------------------------------------------------------------
// Tabla `servicio` — catálogo de servicios que presta la empresa
// -------------------------------------------------------------------------

export const servicios = [
  { id: 'SRV001', nombre: 'Reencauche en frío', descripcion: 'Banda precurada. Incluye inspección y reparación menor.', precio: 320000, garantiaDias: 180, estado: 'Activo' },
  { id: 'SRV002', nombre: 'Reencauche en caliente', descripcion: 'Banda cruda vulcanizada en molde, para carga pesada.', precio: 385000, garantiaDias: 240, estado: 'Activo' },
];

/** Servicio que se asume cuando el cliente solicita un reencauche. */
export const SERVICIO_POR_DEFECTO = 'Reencauche en frío';

// -------------------------------------------------------------------------
// Cotización-pedido (sin tabla en el modelo; paso previo a la venta)
//
// `estadoEntrega` reemplaza al antiguo módulo de entregas: el despacho al
// cliente se sigue desde la propia cotización.
// -------------------------------------------------------------------------

export const cotizaciones = [
  {
    id: 'PED-2024-001', cliente: 'Transportes Andinos SAS', fecha: '2024-07-18', metodoPago: 'Contado', proveedor: 'Michelin Colombia SAS',
    total: '$ 1.968.000', confirmado: true, estado: 'Completada', estadoEntrega: 'Entregado',
    direccionEntrega: 'Cra 30 #25-90, Bogotá', plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Michelin LTX Force', medida: '265/70R16', cantidad: 4, unitario: '$ 492.000', subtotal: '$ 1.968.000' },
    ],
  },
  {
    id: 'PED-2024-002', cliente: 'María García Ruiz', fecha: '2024-07-16', metodoPago: 'Crédito', proveedor: 'Michelin Colombia SAS',
    total: '$ 798.250', confirmado: true, estado: 'En proceso', estadoEntrega: 'Pendiente',
    direccionEntrega: 'Calle 50 #45-12, Medellín', plazoDias: 30, interes: '$ 23.250', cuotaInicial: '$ 399.125',
    detalle: [
      { tipo: 'producto', nombre: 'Michelin Energy XM2+', medida: '195/65R15', cantidad: 2, unitario: '$ 280.000', subtotal: '$ 560.000' },
      { tipo: 'servicio', nombre: 'Reencauche en frío', medida: '295/80R22.5', cantidad: 2, unitario: '$ 107.500', subtotal: '$ 215.000' },
    ],
  },
  {
    id: 'PED-2024-003', cliente: 'Flota Express Ltda', fecha: '2024-06-28', metodoPago: 'Contado', proveedor: 'Goodyear Colombia Ltda',
    total: '$ 4.692.000', confirmado: true, estado: 'Completada', estadoEntrega: 'Entregado',
    direccionEntrega: 'Av 3N #35-12, Cali', plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Goodyear KMax D', medida: '295/80R22.5', cantidad: 3, unitario: '$ 1.250.000', subtotal: '$ 3.750.000' },
      { tipo: 'producto', nombre: 'Goodyear EfficientGrip P2', medida: '225/45R17', cantidad: 2, unitario: '$ 471.000', subtotal: '$ 942.000' },
    ],
  },
  {
    id: 'PED-2024-004', cliente: 'Carlos Arbeláez Ossa', fecha: '2024-06-15', metodoPago: 'Contado', proveedor: 'Bridgestone de Colombia',
    total: '$ 447.000', confirmado: true, estado: 'Rechazada', estadoEntrega: 'Cancelado',
    direccionEntrega: 'Cra 15 #20-40, Barranquilla', plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    motivoCancelacion: 'El cliente desistió de la compra.',
    detalle: [
      { tipo: 'producto', nombre: 'Bridgestone Turanza T005', medida: '205/55R16', cantidad: 1, unitario: '$ 447.000', subtotal: '$ 447.000' },
    ],
  },
  {
    id: 'PED-2024-005', cliente: 'Servicios Terrestres SA', fecha: '2024-07-25', metodoPago: 'Crédito', proveedor: 'Bridgestone de Colombia',
    total: '$ 0', confirmado: false, estado: 'Pendiente', estadoEntrega: 'Pendiente',
    direccionEntrega: 'Calle 80 #50-30, Bogotá', plazoDias: 60, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Bridgestone Alenza 001', medida: '255/50R19', cantidad: 4, unitario: '—', subtotal: '—' },
    ],
  },
];

// -------------------------------------------------------------------------
// Tabla `venta` (+ `detalle_venta` y `detalle_servicio`)
//
// La venta nace sola cuando la cotización llega a "Completada", y también
// puede registrarse directamente sin cotización previa.
// -------------------------------------------------------------------------

export const ventas = [
  {
    id: 'VEN-2024-001', cliente: 'Transportes Andinos SAS', tercero: '', cotizacion: 'PED-2024-001',
    proveedor: 'Michelin Colombia SAS', estadoEntrega: 'Entregado',
    fecha: '2024-07-18', metodoPago: 'Contado', total: '$ 1.968.000', interes: '$ 0', cuotaInicial: '$ 0',
    estado: 'Completada',
    detalle: [
      { tipo: 'producto', nombre: 'Michelin LTX Force', medida: '265/70R16', cantidad: 4, unitario: '$ 492.000', subtotal: '$ 1.968.000' },
    ],
  },
  {
    id: 'VEN-2024-002', cliente: 'Flota Express Ltda', tercero: '', cotizacion: 'PED-2024-003',
    proveedor: 'Goodyear Colombia Ltda', estadoEntrega: 'Entregado',
    fecha: '2024-06-28', metodoPago: 'Contado', total: '$ 4.692.000', interes: '$ 0', cuotaInicial: '$ 0',
    estado: 'Completada',
    detalle: [
      { tipo: 'producto', nombre: 'Goodyear KMax D', medida: '295/80R22.5', cantidad: 3, unitario: '$ 1.250.000', subtotal: '$ 3.750.000' },
      { tipo: 'producto', nombre: 'Goodyear EfficientGrip P2', medida: '225/45R17', cantidad: 2, unitario: '$ 471.000', subtotal: '$ 942.000' },
    ],
  },
  {
    id: 'VEN-2024-003', cliente: 'María García Ruiz', tercero: 'Reencauchadora Vulcanizadora Sur', cotizacion: '',
    proveedor: 'Goodyear Colombia Ltda', estadoEntrega: 'Entregado',
    fecha: '2024-07-02', metodoPago: 'Crédito', total: '$ 3.069.400', interes: '$ 89.400', cuotaInicial: '$ 1.534.700',
    estado: 'Completada',
    detalle: [
      { tipo: 'producto', nombre: 'Goodyear Wrangler AT Silent', medida: '265/65R17', cantidad: 4, unitario: '$ 575.000', subtotal: '$ 2.300.000' },
      { tipo: 'producto', nombre: 'Goodyear EfficientGrip P2', medida: '225/45R17', cantidad: 2, unitario: '$ 340.000', subtotal: '$ 680.000' },
    ],
  },
  {
    id: 'VEN-2024-004', cliente: 'Cooperativa de Taxis Norte', tercero: '', cotizacion: '',
    proveedor: 'Bridgestone de Colombia', estadoEntrega: 'En camino',
    fecha: '2024-07-21', metodoPago: 'Contado', total: '$ 1.340.000', interes: '$ 0', cuotaInicial: '$ 0',
    estado: 'Pendiente',
    detalle: [
      { tipo: 'producto', nombre: 'Bridgestone Turanza T005', medida: '205/55R16', cantidad: 3, unitario: '$ 447.000', subtotal: '$ 1.341.000' },
    ],
  },
];

// -------------------------------------------------------------------------
// Tabla `compra` (+ `detalle_compra`)
//
// Cada compra abastece una cotización aprobada y se le sigue la recepción
// con `estadoEntrega`, ya que el módulo de entregas desapareció.
// -------------------------------------------------------------------------

export const compras = [
  {
    id: 'COM-2024-001', proveedor: 'Michelin Colombia SAS', cotizacion: 'PED-2024-001', fecha: '2024-07-10',
    total: '$ 1.512.000', estado: 'Recibida', estadoEntrega: 'Entregado',
    detalle: [{ producto: 'Michelin LTX Force', cantidad: 4, unitario: '$ 378.000', subtotal: '$ 1.512.000' }],
  },
  {
    id: 'COM-2024-002', proveedor: 'Bridgestone de Colombia', cotizacion: 'PED-2024-005', fecha: '2024-07-26',
    total: '$ 1.872.000', estado: 'Pendiente', estadoEntrega: 'En camino',
    detalle: [{ producto: 'Bridgestone Alenza 001', cantidad: 4, unitario: '$ 468.000', subtotal: '$ 1.872.000' }],
  },
  {
    id: 'COM-2024-003', proveedor: 'Goodyear Colombia Ltda', cotizacion: 'PED-2024-003', fecha: '2024-06-20',
    total: '$ 3.596.000', estado: 'Recibida', estadoEntrega: 'Entregado',
    detalle: [
      { producto: 'Goodyear KMax D', cantidad: 3, unitario: '$ 960.000', subtotal: '$ 2.880.000' },
      { producto: 'Goodyear EfficientGrip P2', cantidad: 2, unitario: '$ 358.000', subtotal: '$ 716.000' },
    ],
  },
  {
    id: 'COM-2024-004', proveedor: 'Continental Distribuciones SA', cotizacion: '', fecha: '2024-07-28',
    total: '$ 704.000', estado: 'Pendiente', estadoEntrega: 'Pendiente',
    detalle: [{ producto: 'Continental PremiumContact 7', cantidad: 2, unitario: '$ 352.000', subtotal: '$ 704.000' }],
  },
];

// -------------------------------------------------------------------------
// Solicitudes de servicio de reencauche
// (sin tabla en el modelo; las exige el proceso de servicios de la ficha)
// -------------------------------------------------------------------------

export const solicitudesServicio = [
  { id: 'SOL-001', cliente: 'María García Ruiz', servicio: 'Reencauche en frío', tercero: 'Reencauchadora Vulcanizadora Sur', medidas: '295/80R22.5', cantidad: 2, fecha: '2024-07-12', estado: 'Completado', estadoEvidencia: 'Apta', garantia: 'Sí', tiempoEstimado: '9 días', descripcion: 'Carcasa sin cortes laterales.', foto: '' },
  { id: 'SOL-002', cliente: 'Transportes Andinos SAS', servicio: 'Reencauche en caliente', tercero: 'Reencauches del Valle SAS', medidas: '295/80R22.5', cantidad: 6, fecha: '2024-07-20', estado: 'En proceso', estadoEvidencia: 'Apta', garantia: 'Sí', tiempoEstimado: '12 días', descripcion: 'Segunda vida de la carcasa.', foto: '' },
  { id: 'SOL-003', cliente: 'Flota Express Ltda', servicio: 'Reencauche en frío', tercero: '', medidas: '265/70R16', cantidad: 4, fecha: '2024-07-27', estado: 'Pendiente', estadoEvidencia: 'Pendiente de revisión', garantia: 'No', tiempoEstimado: '', descripcion: 'A la espera de la revisión del asesor.', foto: '' },
  { id: 'SOL-004', cliente: 'Luis Fernando Mora', servicio: 'Reencauche en frío', tercero: 'Renovadora Andina Ltda', medidas: '225/45R17', cantidad: 1, fecha: '2024-06-30', estado: 'Cancelado', estadoEvidencia: 'No apta', garantia: 'No', tiempoEstimado: '', descripcion: 'Flanco con daño estructural, no reencauchable.', foto: '' },
];

// -------------------------------------------------------------------------
// Tabla `credito` (+ `abono`) y solicitudes de crédito
// -------------------------------------------------------------------------

export const creditos = [
  { id: 'CRE-001', cliente: 'Transportes Andinos SAS', venta: 'VEN-2024-001', montoTotal: '$ 2.026.040', saldoPendiente: '$ 1.026.040', plazoDias: 30, fechaApertura: '2024-07-18', fechaLimite: '2024-08-17', estado: 'Activo' },
  { id: 'CRE-002', cliente: 'María García Ruiz', venta: 'VEN-2024-003', montoTotal: '$ 3.069.400', saldoPendiente: '$ 575.000', plazoDias: 60, fechaApertura: '2024-07-02', fechaLimite: '2024-08-31', estado: 'Activo' },
  { id: 'CRE-003', cliente: 'Servicios Terrestres SA', venta: '', montoTotal: '$ 1.200.000', saldoPendiente: '$ 0', plazoDias: 30, fechaApertura: '2024-05-10', fechaLimite: '2024-06-09', estado: 'Inactivo' },
];

export const abonos = [
  { id: 'ABO-001', credito: 'CRE-001', cliente: 'Transportes Andinos SAS', monto: '$ 1.000.000', fecha: '2024-07-25', metodoPago: 'Transferencia', comprobante: '', estado: 'Confirmado' },
  { id: 'ABO-002', credito: 'CRE-002', cliente: 'María García Ruiz', monto: '$ 1.534.700', fecha: '2024-07-02', metodoPago: 'Tarjeta', comprobante: '', estado: 'Confirmado' },
  { id: 'ABO-003', credito: 'CRE-002', cliente: 'María García Ruiz', monto: '$ 959.700', fecha: '2024-07-30', metodoPago: 'Transferencia', comprobante: '', estado: 'Confirmado' },
  { id: 'ABO-004', credito: 'CRE-003', cliente: 'Servicios Terrestres SA', monto: '$ 1.200.000', fecha: '2024-06-05', metodoPago: 'Efectivo', comprobante: '', estado: 'Confirmado' },
  { id: 'ABO-005', credito: 'CRE-002', cliente: 'María García Ruiz', monto: '$ 200.000', fecha: '2024-08-04', metodoPago: 'Tarjeta', comprobante: '', estado: 'Pendiente' },
];

export const solicitudesCredito = [
  { id: 'SLC-001', cliente: 'María García Ruiz', monto: '$ 800.000', plazoDias: 30, fecha: '2024-07-28', estado: 'Pendiente', motivo: '' },
  { id: 'SLC-002', cliente: 'Flota Express Ltda', monto: '$ 2.500.000', plazoDias: 90, fecha: '2024-07-15', estado: 'Aprobada', motivo: '' },
  { id: 'SLC-003', cliente: 'Carlos Arbeláez Ossa', monto: '$ 1.500.000', plazoDias: 60, fecha: '2024-06-22', estado: 'Rechazada', motivo: 'Cartera vencida en un crédito anterior.' },
];

// -------------------------------------------------------------------------
// Dashboard del administrador
// -------------------------------------------------------------------------

export const dashboardStats = [
  { id: 'ventas', label: 'VENTAS DEL MES', value: '$ 27.800.000', sub: '56 transacciones', trend: '+11.7% vs mes anterior', trendUp: true, icon: 'DollarSign', accent: 'amber' },
  { id: 'pedidos', label: 'PEDIDOS ACTIVOS', value: '23', sub: '7 en proceso', trend: '+4.2% vs mes anterior', trendUp: true, icon: 'FileText', accent: 'blue' },
];

/** Ventas por mes, base del reporte estadístico exigido por la ficha. */
export const ventasPorMes = [
  { month: 'Ene', ventas: 14200000 },
  { month: 'Feb', ventas: 16800000 },
  { month: 'Mar', ventas: 15400000 },
  { month: 'Abr', ventas: 22100000 },
  { month: 'May', ventas: 26900000 },
  { month: 'Jun', ventas: 28300000 },
  { month: 'Jul', ventas: 27800000 },
];

/** Servicios de reencauche procesados por mes. */
export const reencauchesPorMes = [
  { month: 'Ene', reencauches: 18 },
  { month: 'Feb', reencauches: 24 },
  { month: 'Mar', reencauches: 21 },
  { month: 'Abr', reencauches: 32 },
  { month: 'May', reencauches: 28 },
  { month: 'Jun', reencauches: 37 },
  { month: 'Jul', reencauches: 41 },
];

/** Ranking de productos más vendidos (caso de uso del dashboard). */
export const rankingProductos = [
  { producto: 'Michelin Energy XM2+', unidades: 128, total: '$ 35.840.000' },
  { producto: 'Bridgestone Turanza T005', unidades: 96, total: '$ 42.912.000' },
  { producto: 'Goodyear KMax D', unidades: 54, total: '$ 67.500.000' },
  { producto: 'Continental PremiumContact 7', unidades: 47, total: '$ 21.855.000' },
  { producto: 'Michelin LTX Force', unidades: 41, total: '$ 20.172.000' },
];

export const salesByBrand = [
  { name: 'Michelin', value: 34, color: '#FBBF24' },
  { name: 'Bridgestone', value: 27, color: '#3B82F6' },
  { name: 'Goodyear', value: 24, color: '#22C55E' },
  { name: 'Continental', value: 15, color: '#A78BFA' },
];

export const systemAlerts = [
  { id: 1, type: 'warning', text: 'Stock crítico: Michelin LTX Force — 4 unid.' },
  { id: 2, type: 'danger', text: 'Crédito CRE-002 vence en 5 días — María García Ruiz' },
  { id: 3, type: 'info', text: 'Compra COM-2024-002 en camino desde Bridgestone' },
  { id: 4, type: 'warning', text: 'Cotización PED-2024-005 sin valor confirmado' },
  { id: 5, type: 'warning', text: 'Solicitud SOL-003 sin reencauchadora asignada' },
  { id: 6, type: 'warning', text: 'Abono ABO-005 pendiente de validar la consignación' },
  { id: 7, type: 'warning', text: 'Solicitud de crédito SLC-001 sin revisar' },
  { id: 8, type: 'warning', text: 'Producto Michelin Pilot Sport 5 inactivo' },
];

// -------------------------------------------------------------------------
// Portal del cliente — sesión de María García Ruiz (CLI002)
// -------------------------------------------------------------------------

export const CLIENTE_EN_SESION = 'María García Ruiz';

export const clientProfile = {
  nombre: 'María García Ruiz',
  tipoDocumento: 'CC',
  numeroDocumento: '1024567890',
  correo: 'maria@gmail.com',
  telefono: '3119876543',
  direccion: 'Calle 50 #45-12, Medellín',
  foto: '',
};

export const adminProfile = {
  nombre: 'Carlos Mendoza',
  tipoDocumento: 'CC',
  numeroDocumento: '79456123',
  correo: 'admin@mirallantas.com',
  telefono: '3001112233',
  rol: 'Administrador',
  estado: 'Activo',
  foto: '',
};

/**
 * Cotizaciones-pedido del cliente en sesión. Cada carta muestra el estado
 * de la cotización y el de su entrega, tal como pide el subproceso móvil.
 */
export const clientCotizaciones = [
  {
    id: 'PED-2024-002', fecha: '2024-07-16', metodoPago: 'Crédito', items: 4, total: '$ 798.250',
    estado: 'En proceso', estadoEntrega: 'Pendiente', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 30, interes: '$ 23.250', cuotaInicial: '$ 399.125',
    detalle: [
      { tipo: 'producto', nombre: 'Michelin Energy XM2+', medida: '195/65R15', cantidad: 2, unitario: '$ 280.000', subtotal: '$ 560.000' },
      { tipo: 'servicio', nombre: 'Reencauche en frío', medida: '295/80R22.5', cantidad: 2, unitario: '$ 107.500', subtotal: '$ 215.000', solicitud: 'SOL-001' },
    ],
  },
  {
    id: 'PED-2024-008', fecha: '2024-07-09', metodoPago: 'Contado', items: 2, total: '$ 1.240.000',
    estado: 'Completada', estadoEntrega: 'En camino', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Bridgestone Alenza 001', medida: '255/50R19', cantidad: 2, unitario: '$ 620.000', subtotal: '$ 1.240.000' },
    ],
  },
  {
    id: 'PED-2024-014', fecha: '2024-06-28', metodoPago: 'Crédito', items: 6, total: '$ 3.069.400',
    estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 60, interes: '$ 89.400', cuotaInicial: '$ 1.534.700',
    detalle: [
      { tipo: 'producto', nombre: 'Goodyear Wrangler AT Silent', medida: '265/65R17', cantidad: 4, unitario: '$ 575.000', subtotal: '$ 2.300.000' },
      { tipo: 'producto', nombre: 'Goodyear EfficientGrip P2', medida: '225/45R17', cantidad: 2, unitario: '$ 340.000', subtotal: '$ 680.000' },
    ],
  },
  {
    id: 'PED-2024-019', fecha: '2024-06-15', metodoPago: 'Contado', items: 1, total: '$ 320.000',
    estado: 'Rechazada', estadoEntrega: 'Cancelado', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    motivoCancelacion: 'La carcasa no pasó la revisión de la reencauchadora.',
    detalle: [
      { tipo: 'servicio', nombre: 'Reencauche en frío', medida: '295/80R22.5', cantidad: 1, unitario: '$ 320.000', subtotal: '$ 320.000', solicitud: 'SOL-004' },
    ],
  },
  {
    id: 'PED-2024-023', fecha: '2024-06-02', metodoPago: 'Contado', items: 4, total: '$ 1.560.000',
    estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Cra 43A #7-50, Medellín',
    plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Continental PremiumContact 7', medida: '215/60R17', cantidad: 2, unitario: '$ 465.000', subtotal: '$ 930.000' },
      { tipo: 'producto', nombre: 'Continental VanContact 100', medida: '235/65R16', cantidad: 2, unitario: '$ 315.000', subtotal: '$ 630.000' },
    ],
  },
  {
    id: 'PED-2024-027', fecha: '2024-05-21', metodoPago: 'Contado', items: 2, total: '$ 890.000',
    estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Michelin Pilot Sport 5', medida: '225/40R18', cantidad: 1, unitario: '$ 720.000', subtotal: '$ 720.000' },
      { tipo: 'servicio', nombre: 'Reencauche en frío', medida: '265/70R16', cantidad: 1, unitario: '$ 170.000', subtotal: '$ 170.000', solicitud: 'SOL-003' },
    ],
  },
  {
    id: 'PED-2024-031', fecha: '2024-05-08', metodoPago: 'Crédito', items: 8, total: '$ 4.367.200',
    estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 60, interes: '$ 247.200', cuotaInicial: '$ 2.183.600',
    detalle: [
      { tipo: 'producto', nombre: 'Bridgestone Potenza RE050A', medida: '245/45R18', cantidad: 4, unitario: '$ 610.000', subtotal: '$ 2.440.000' },
      { tipo: 'producto', nombre: 'Bridgestone Turanza T005', medida: '205/55R16', cantidad: 4, unitario: '$ 420.000', subtotal: '$ 1.680.000' },
    ],
  },
  {
    id: 'PED-2024-035', fecha: '2024-04-27', metodoPago: 'Contado', items: 2, total: '$ 640.000',
    estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Michelin Energy XM2+', medida: '195/65R15', cantidad: 2, unitario: '$ 320.000', subtotal: '$ 640.000' },
    ],
  },
  {
    id: 'PED-2024-040', fecha: '2024-04-11', metodoPago: 'Contado', items: 4, total: '$ 1.780.000',
    estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Goodyear KMax D', medida: '295/80R22.5', cantidad: 1, unitario: '$ 1.250.000', subtotal: '$ 1.250.000' },
      { tipo: 'servicio', nombre: 'Reencauche en caliente', medida: '295/80R22.5', cantidad: 3, unitario: '$ 176.667', subtotal: '$ 530.000', solicitud: 'SOL-002' },
    ],
  },
  {
    id: 'PED-2024-044', fecha: '2024-03-30', metodoPago: 'Contado', items: 1, total: '$ 415.000',
    estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Continental VanContact 100', medida: '235/65R16', cantidad: 1, unitario: '$ 415.000', subtotal: '$ 415.000' },
    ],
  },
  {
    id: 'PED-2024-049', fecha: '2024-03-14', metodoPago: 'Contado', items: 4, total: '$ 1.290.000',
    estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Michelin LTX Force', medida: '265/70R16', cantidad: 2, unitario: '$ 520.000', subtotal: '$ 1.040.000' },
      { tipo: 'servicio', nombre: 'Reencauche en frío', medida: '265/70R16', cantidad: 2, unitario: '$ 125.000', subtotal: '$ 250.000' },
    ],
  },
  {
    id: 'PED-2024-053', fecha: '2024-02-26', metodoPago: 'Contado', items: 2, total: '$ 720.000',
    estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Calle 50 #45-12, Medellín',
    plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
    detalle: [
      { tipo: 'producto', nombre: 'Bridgestone Turanza T005', medida: '205/55R16', cantidad: 2, unitario: '$ 360.000', subtotal: '$ 720.000' },
    ],
  },
];

/** Cartera del cliente en sesión: sus créditos y los abonos de cada uno. */
export const clientCreditos = [
  { id: 'CRE-002', venta: 'VEN-2024-003', cotizacion: 'PED-2024-014', montoTotal: '$ 3.069.400', saldoPendiente: '$ 575.000', plazoDias: 60, fechaApertura: '2024-07-02', fechaLimite: '2024-08-31', estado: 'Activo' },
  { id: 'CRE-011', venta: '', cotizacion: 'PED-2024-031', montoTotal: '$ 4.367.200', saldoPendiente: '$ 0', plazoDias: 60, fechaApertura: '2024-05-08', fechaLimite: '2024-07-07', estado: 'Inactivo' },
  { id: 'CRE-008', venta: '', cotizacion: 'PED-2024-002', montoTotal: '$ 798.250', saldoPendiente: '$ 0', plazoDias: 30, fechaApertura: '2024-07-16', fechaLimite: '2024-08-15', estado: 'Inactivo' },
];

/**
 * Pantallazo de consignacion de ejemplo. Sin backend no hay archivos
 * subidos, asi que los abonos por transferencia traen esta imagen para que
 * el detalle del abono se pueda ver completo.
 */
export const comprobanteDemo =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260">
       <rect width="420" height="260" fill="#0F172A"/>
       <rect x="16" y="16" width="388" height="228" rx="14" fill="#F8FAFC"/>
       <rect x="16" y="16" width="388" height="52" rx="14" fill="#FBBF24"/>
       <text x="36" y="49" font-family="Arial" font-size="17" font-weight="bold" fill="#0F172A">Transferencia exitosa</text>
       <text x="36" y="104" font-family="Arial" font-size="12" fill="#64748B">Destino</text>
       <text x="36" y="124" font-family="Arial" font-size="14" font-weight="bold" fill="#0F172A">MiraLlantas SAS - Ahorros 4780</text>
       <text x="36" y="158" font-family="Arial" font-size="12" fill="#64748B">Valor</text>
       <text x="36" y="180" font-family="Arial" font-size="20" font-weight="bold" fill="#0F172A">Comprobante de pago</text>
       <text x="36" y="214" font-family="Arial" font-size="12" fill="#64748B">Aprobacion 00918342 - Banco de ejemplo</text>
     </svg>`,
  );

export const clientAbonos = [
  { id: 'ABO-002', credito: 'CRE-002', fecha: '2024-07-02', monto: '$ 1.534.700', metodoPago: 'Tarjeta', comprobante: '', estado: 'Confirmado' },
  { id: 'ABO-003', credito: 'CRE-002', fecha: '2024-07-30', monto: '$ 959.700', metodoPago: 'Transferencia', comprobante: comprobanteDemo, estado: 'Confirmado' },
  { id: 'ABO-005', credito: 'CRE-002', fecha: '2024-08-04', monto: '$ 200.000', metodoPago: 'Tarjeta', comprobante: '', estado: 'Pendiente' },
  { id: 'ABO-021', credito: 'CRE-011', fecha: '2024-06-20', monto: '$ 4.367.200', metodoPago: 'Transferencia', comprobante: comprobanteDemo, estado: 'Confirmado' },
  { id: 'ABO-017', credito: 'CRE-008', fecha: '2024-07-20', monto: '$ 798.250', metodoPago: 'Efectivo', comprobante: '', estado: 'Confirmado' },
];

/** Solicitudes de crédito que ha levantado el cliente en sesión. */
export const clientSolicitudesCredito = [
  { id: 'SLC-001', monto: '$ 800.000', plazoDias: 30, fecha: '2024-07-28', estado: 'Pendiente', motivo: '' },
];

export const clientHomeStats = [
  { id: 'pedidos', label: 'MIS PEDIDOS-COTIZACIÓN', value: '12', sub: '1 cotización pendiente', icon: 'FileText', accent: 'amber' },
  { id: 'entrega', label: 'PRÓXIMA ENTREGA', value: '22 Jul', sub: 'PED-2024-008 · en camino', icon: 'Truck', accent: 'blue' },
  { id: 'credito', label: 'MI CRÉDITO', value: '$ 575.000', sub: 'Saldo pendiente de tu crédito', icon: 'CreditCard', accent: 'emerald' },
  { id: 'total', label: 'TOTAL COMPRADO', value: '$ 16.730.000', sub: 'Este año', icon: 'DollarSign', accent: 'violet' },
];

// -------------------------------------------------------------------------
// Cuentas de cliente para pruebas
//
// El portal trabaja siempre con un cliente en sesión. Se dejan dos juegos
// de datos para poder probar los dos escenarios de cartera: María, que
// arrastra un crédito abierto, y Luis, que compra siempre de contado y por
// tanto tiene el cupo entero disponible.
// -------------------------------------------------------------------------

/** Cliente sin crédito (CLI006), para probar la cartera en limpio. */
export const clienteSinCredito = {
  id: 'CLI006',
  profile: {
    nombre: 'Luis Fernando Mora',
    tipoDocumento: 'CC',
    numeroDocumento: '19876543',
    correo: 'lfmora@yahoo.com',
    telefono: '3204449988',
    direccion: 'Cra 5 #10-22, Pereira',
    foto: '',
  },
  cotizaciones: [
    {
      id: 'PED-2024-061', fecha: '2024-07-22', metodoPago: 'Contado', items: 2, total: '$ 894.000',
      estado: 'Completada', estadoEntrega: 'Entregado', direccionEntrega: 'Cra 5 #10-22, Pereira',
      plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
      detalle: [
        { tipo: 'producto', nombre: 'Bridgestone Turanza T005', medida: '205/55R16', cantidad: 2, unitario: '$ 447.000', subtotal: '$ 894.000' },
      ],
    },
    {
      id: 'PED-2024-064', fecha: '2024-07-30', metodoPago: 'Contado', items: 4, total: '$ 1.860.000',
      estado: 'En proceso', estadoEntrega: 'En camino', direccionEntrega: 'Cra 5 #10-22, Pereira',
      plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
      detalle: [
        { tipo: 'producto', nombre: 'Continental PremiumContact 7', medida: '215/60R17', cantidad: 4, unitario: '$ 465.000', subtotal: '$ 1.860.000' },
      ],
    },
    {
      id: 'PED-2024-068', fecha: '2024-08-02', metodoPago: 'Contado', items: 2, total: '$ 640.000',
      estado: 'Pendiente', estadoEntrega: 'Pendiente', direccionEntrega: 'Cra 5 #10-22, Pereira',
      plazoDias: 0, interes: '$ 0', cuotaInicial: '$ 0',
      detalle: [
        { tipo: 'servicio', nombre: 'Reencauche en frío', medida: '265/70R16', cantidad: 2, unitario: '$ 320.000', subtotal: '$ 640.000', solicitud: 'SOL-004' },
      ],
    },
  ],
  // Sin cartera: ni créditos, ni abonos, ni solicitudes
  creditos: [],
  abonos: [],
  solicitudesCredito: [],
  homeStats: [
    { id: 'pedidos', label: 'MIS PEDIDOS-COTIZACIÓN', value: '3', sub: '1 cotización en proceso', icon: 'FileText', accent: 'amber' },
    { id: 'entrega', label: 'PRÓXIMA ENTREGA', value: '30 Jul', sub: 'PED-2024-064 · en camino', icon: 'Truck', accent: 'blue' },
    { id: 'credito', label: 'MI CRÉDITO', value: '$ 0', sub: 'Sin créditos abiertos', icon: 'CreditCard', accent: 'emerald' },
    { id: 'total', label: 'TOTAL COMPRADO', value: '$ 3.394.000', sub: 'Este año', icon: 'DollarSign', accent: 'violet' },
  ],
};

/** Cliente con un crédito vigente (CLI002), el de siempre. */
export const clienteConCredito = {
  id: 'CLI002',
  profile: clientProfile,
  cotizaciones: clientCotizaciones,
  creditos: clientCreditos,
  abonos: clientAbonos,
  solicitudesCredito: clientSolicitudesCredito,
  homeStats: clientHomeStats,
};

/** Cuentas de prueba del portal, por correo de acceso. */
export const clientesDemo = {
  'maria@gmail.com': clienteConCredito,
  'lfmora@yahoo.com': clienteSinCredito,
};

/** Cuenta con la que arranca el portal si se entra sin pasar por el login. */
export const CLIENTE_DEMO_POR_DEFECTO = 'maria@gmail.com';
