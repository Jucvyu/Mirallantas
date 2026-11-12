// =========================================================================
// Campos del producto (modelo de llanta) y de sus medidas, para el panel.
//
// Los usan el alta rápida, la página del producto y la configuración de
// categorías. Cada categoría puede marcar datos que no aplican (p. ej. una
// llanta de moto sin lonas ni posición): esos campos no se muestran.
// =========================================================================

export const POSICIONES = ['Tracción', 'Direccional', 'Cualquier posición'];
export const CONSTRUCCIONES = ['Radial', 'Diagonal'];
export const SI_NO = ['Sí', 'No'];

/**
 * Datos que una categoría puede marcar como "no aplica". La clave es la que
 * guarda la API (categoria.campos_ocultos); la etiqueta, la que ve el admin.
 */
export const CAMPOS_OCULTABLES = [
  { clave: 'posicion', etiqueta: 'Posición (tracción / direccional)', grupo: 'Medidas' },
  { clave: 'indiceCarga', etiqueta: 'Índice de carga', grupo: 'Medidas' },
  { clave: 'lonas', etiqueta: 'Lonas', grupo: 'Medidas' },
  { clave: 'profundidadLabrado', etiqueta: 'Profundidad del labrado', grupo: 'Medidas' },
  { clave: 'pesoKg', etiqueta: 'Peso', grupo: 'Medidas' },
  { clave: 'codigoFabricante', etiqueta: 'Código del fabricante', grupo: 'Medidas' },
  { clave: 'uso', etiqueta: 'Uso', grupo: 'Ficha técnica' },
  { clave: 'labrado', etiqueta: 'Tipo de labrado', grupo: 'Ficha técnica' },
  { clave: 'construccion', etiqueta: 'Construcción', grupo: 'Ficha técnica' },
  { clave: 'sinCamara', etiqueta: 'Sin cámara', grupo: 'Ficha técnica' },
  { clave: 'recauchable', etiqueta: 'Recauchable', grupo: 'Ficha técnica' },
  { clave: 'garantiaMeses', etiqueta: 'Garantía', grupo: 'Ficha técnica' },
  { clave: 'paisOrigen', etiqueta: 'País de origen', grupo: 'Ficha técnica' },
];

/** ['lonas', 'posicion'] → 'Lonas, Posición (…)' (lo que guarda un campo de casillas). */
export const ocultosATexto = (claves = []) =>
  CAMPOS_OCULTABLES.filter((c) => claves.includes(c.clave)).map((c) => c.etiqueta).join(', ');

/** 'Lonas, Posición (…)' → ['lonas', 'posicion'] */
export const textoAOcultos = (texto = '') => {
  const elegidas = String(texto).split(',').map((v) => v.trim());
  return CAMPOS_OCULTABLES.filter((c) => elegidas.includes(c.etiqueta)).map((c) => c.clave);
};

/** Datos que no aplican a la categoría elegida (por nombre). */
export const ocultosDe = (categorias, nombreCategoria) =>
  new Set(categorias.find((c) => c.nombre === nombreCategoria)?.camposOcultos ?? []);

// ---- Reglas de los campos numéricos -------------------------------------------

const decimal = (texto) => Number(String(texto).trim().replace(',', '.'));
const decimales = (texto) => (String(texto).split(/[.,]/)[1] ?? '').length;
const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

export const validarIndiceCarga = (v) =>
  vacio(v) || /^[0-9]{2,3}(\/[0-9]{2,3})?$/.test(String(v).trim()) ? '' : 'Usa 2 o 3 dígitos, o dos con "/" (152/148)';
export const validarLonas = (v) => {
  if (vacio(v)) return '';
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 40 ? '' : 'De 1 a 40';
};
export const validarProfundidad = (v) => {
  if (vacio(v)) return '';
  const n = decimal(v);
  if (!(n > 0) || n > 50) return 'Entre 0,1 y 50 mm';
  return decimales(v) > 1 ? 'Máximo un decimal' : '';
};
export const validarPeso = (v) => {
  if (vacio(v)) return '';
  const n = decimal(v);
  if (!(n > 0) || n > 2000) return 'Entre 0,01 y 2000 kg';
  return decimales(v) > 2 ? 'Máximo dos decimales' : '';
};
export const validarGarantia = (v) => {
  if (vacio(v)) return '';
  const n = Number(String(v).trim());
  return Number.isInteger(n) && n >= 0 && n <= 240 ? '' : 'Escribe los meses, de 0 a 240';
};

/** Medida como la guarda el servidor: sin espacios y en mayúsculas. */
export const normalizarMedida = (v) => String(v ?? '').replace(/\s+/g, '').toUpperCase();

// ---- Formularios ------------------------------------------------------------------

const activos = (lista) => lista.filter((x) => x.activo !== false).map((x) => x.nombre);

/** Lo mínimo para crear un producto (lo demás se llena en su página). */
export function camposBasicos({ categorias, marcas, tipos }) {
  return [
    { key: 'nombre', label: 'Nombre del producto', required: true, placeholder: 'p. ej. X Multi Z' },
    { key: 'marca', label: 'Marca', type: 'buscador', required: true, options: activos(marcas), emptyLabel: 'marca' },
    { key: 'categoria', label: 'Categoría', type: 'buscador', required: true, options: activos(categorias), emptyLabel: 'categoría' },
    { key: 'tipoVehiculo', label: 'Tipo de vehículo', type: 'buscador', options: tipos.map((t) => t.nombre) },
  ];
}

/** Pestaña General: lo básico, la descripción y la foto. */
export function camposGeneral(listas) {
  return [
    ...camposBasicos(listas),
    { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2, max: 200, placeholder: 'Para qué sirve y qué la distingue' },
    {
      key: 'foto',
      label: 'Foto del producto',
      type: 'image',
      span: 2,
      placeholder: 'Sube la foto de la llanta (JPG o PNG). La usan todas sus medidas.',
    },
  ];
}

/** Pestaña Ficha técnica, sin los datos que no aplican a la categoría. */
export function camposFicha(ocultos = new Set()) {
  return [
    { key: 'uso', label: 'Uso', placeholder: 'p. ej. Regional, urbano, mixto' },
    { key: 'labrado', label: 'Tipo de labrado', placeholder: 'p. ej. Rayado, de tacos', max: 60 },
    { key: 'construccion', label: 'Construcción', type: 'select', options: CONSTRUCCIONES },
    { key: 'sinCamara', label: 'Sin cámara (tubeless)', type: 'select', options: SI_NO },
    { key: 'recauchable', label: 'Recauchable', type: 'select', options: SI_NO },
    { key: 'garantiaMeses', label: 'Garantía (meses)', placeholder: 'p. ej. 60', max: 3, validar: validarGarantia },
    { key: 'paisOrigen', label: 'País de origen', max: 60 },
  ]
    .filter((f) => !ocultos.has(f.key))
    .concat([
      {
        key: 'fuenteFicha',
        label: 'De dónde se copió la ficha',
        span: 2,
        max: 300,
        placeholder: 'Página del fabricante o del proveedor',
        hint: 'Solo la ve el personal: no sale en el catálogo.',
      },
      {
        key: 'fichaPdf',
        label: 'Ficha técnica del fabricante (PDF)',
        type: 'pdf',
        span: 2,
        placeholder: 'Sube el PDF de la ficha (máximo 5 MB). El cliente lo puede abrir desde el producto.',
      },
    ]);
}

/**
 * Columnas de la tabla de medidas. `ancho` es la clase de la columna;
 * `validar` devuelve el mensaje de error de la celda.
 */
export function columnasMedida(ocultos = new Set()) {
  return [
    { key: 'medidas', label: 'Medida', placeholder: '295/80R22.5', ancho: 'w-36', requerido: true },
    { key: 'posicion', label: 'Posición', tipo: 'select', opciones: POSICIONES, ancho: 'w-40' },
    { key: 'indiceCarga', label: 'Índice de carga', placeholder: '152/148', ancho: 'w-28', validar: validarIndiceCarga, max: 7 },
    { key: 'lonas', label: 'Lonas', placeholder: '16', ancho: 'w-20', validar: validarLonas, max: 2, numerico: true },
    { key: 'profundidadLabrado', label: 'Labrado (mm)', placeholder: '16,5', ancho: 'w-24', validar: validarProfundidad, max: 5 },
    { key: 'pesoKg', label: 'Peso (kg)', placeholder: '64,2', ancho: 'w-24', validar: validarPeso, max: 7 },
    { key: 'codigoFabricante', label: 'Cód. fabricante', placeholder: 'Opcional', ancho: 'w-32', max: 40 },
  ].filter((c) => !ocultos.has(c.key));
}

/** Cuántos datos de la ficha están llenos (para el indicador de avance). */
export function avanceFicha(valores, ocultos = new Set()) {
  const campos = camposFicha(ocultos).filter((f) => f.key !== 'fuenteFicha');
  const llenos = campos.filter((f) => !vacio(valores[f.key])).length;
  return { llenos, total: campos.length };
}
