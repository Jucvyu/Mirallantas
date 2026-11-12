import { useMemo, useState } from 'react';
import { Pencil, Plus, TriangleAlert } from 'lucide-react';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import FormModal from '../../../components/base/FormModal';
import BotonAccion from '../../../components/base/BotonAccion';
import StatusSwitch from '../../../components/base/StatusSwitch';
import AvisoError from '../../../components/base/AvisoError';
import { estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import {
  categoriasService,
  marcasService,
  modelosService,
  productosService,
  referenciasService,
  tiposVehiculoService,
} from '../../../services';

// Catálogo por modelos (migración 0040).
//
// Cada fila de la tabla es un MODELO de llanta (marca + nombre, con su ficha
// técnica y su foto). Al desplegarlo se ven sus MEDIDAS (referencias): cada
// una es el producto que se vende, con su código ML-… (lo genera el
// servidor), su índice de carga, lonas, profundidad y peso. Lo que se
// cambia en el modelo pasa a todas sus medidas. La gestión no maneja
// precios ni stock: el precio se define en cada cotización.
//
// Las llantas reencauchadas (unidad única con precio fijo) no se agrupan:
// van en su propia tabla, como antes.

const POSICIONES = ['Direccional', 'Tracción', 'Cualquier posición'];
const CONSTRUCCIONES = ['Radial', 'Diagonal'];
const SI_NO = ['Sí', 'No'];

// ---- Reglas de los campos numéricos -----------------------------------------

const decimal = (texto) => Number(String(texto).trim().replace(',', '.'));
const decimales = (texto) => (String(texto).split(/[.,]/)[1] ?? '').length;

const validarIndiceCarga = (v) =>
  /^[0-9]{2,3}(\/[0-9]{2,3})?$/.test(String(v).trim()) ? '' : 'Usa 2 o 3 dígitos, o dos separados por "/" (p. ej. 152/148)';
const validarProfundidad = (v) => {
  const n = decimal(v);
  if (!(n > 0) || n > 50) return 'Escribe los milímetros, entre 0,1 y 50';
  return decimales(v) > 1 ? 'Usa máximo un decimal (p. ej. 16,5)' : '';
};
const validarPeso = (v) => {
  const n = decimal(v);
  if (!(n > 0) || n > 2000) return 'Escribe los kilos, entre 0,01 y 2000';
  return decimales(v) > 2 ? 'Usa máximo dos decimales' : '';
};
const validarLonas = (v) => (Number(v) > 40 ? 'Máximo 40 lonas' : '');
const validarGarantia = (v) => {
  const n = Number(String(v).trim());
  return Number.isInteger(n) && n >= 0 && n <= 240 ? '' : 'Escribe los meses, de 0 a 240';
};

/** Campos de una medida (los usan el alta del modelo y el formulario de medida). */
function camposMedida(medidas, { requerida }) {
  return [
    {
      key: 'medidas',
      label: 'Medida',
      type: 'buscador',
      required: requerida,
      options: medidas,
      permitirNuevo: true,
      placeholderBusqueda: 'Escribe la medida, p. ej. 295/80R22.5',
      hint: 'Busca una medida existente o escribe una nueva.',
    },
    { key: 'indiceCarga', label: 'Índice de carga', placeholder: 'p. ej. 152/148', max: 7, validar: validarIndiceCarga },
    { key: 'lonas', label: 'Lonas (PR)', type: 'number', placeholder: 'p. ej. 16', validar: validarLonas },
    { key: 'profundidadLabrado', label: 'Profundidad del labrado (mm)', placeholder: 'p. ej. 16,5', max: 5, validar: validarProfundidad },
    { key: 'pesoKg', label: 'Peso (kg)', placeholder: 'p. ej. 64,2', max: 7, validar: validarPeso },
    { key: 'codigoFabricante', label: 'Código del fabricante', placeholder: 'Código o SKU del fabricante', max: 40 },
  ];
}

/** Formulario del modelo: datos básicos, ficha técnica, foto (y la primera medida al crear). */
function seccionesModelo({ categorias, marcas, tipos, medidas }) {
  const activos = (lista) => lista.filter((x) => x.activo !== false).map((x) => x.nombre);
  return [
    {
      title: 'Datos básicos',
      fields: [
        { key: 'nombre', label: 'Nombre del producto', required: true, placeholder: 'p. ej. X Multi Z' },
        { key: 'marca', label: 'Marca', type: 'buscador', required: true, options: activos(marcas), emptyLabel: 'marca' },
        { key: 'categoria', label: 'Categoría', type: 'buscador', required: true, options: activos(categorias), emptyLabel: 'categoría' },
        { key: 'tipoVehiculo', label: 'Tipo de vehículo', type: 'buscador', options: tipos.map((t) => t.nombre) },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2, max: 200 },
      ],
    },
    {
      title: 'Ficha técnica',
      fields: [
        { key: 'uso', label: 'Uso', placeholder: 'p. ej. Regional, urbano, mixto' },
        { key: 'posicion', label: 'Posición', type: 'select', options: POSICIONES },
        { key: 'labrado', label: 'Labrado', placeholder: 'p. ej. Rayado, de tacos', max: 60 },
        { key: 'construccion', label: 'Construcción', type: 'select', options: CONSTRUCCIONES },
        { key: 'sinCamara', label: 'Sin cámara (tubeless)', type: 'select', options: SI_NO },
        { key: 'recauchable', label: 'Recauchable', type: 'select', options: SI_NO },
        { key: 'garantiaMeses', label: 'Garantía (meses)', placeholder: 'p. ej. 60', max: 3, validar: validarGarantia },
        { key: 'paisOrigen', label: 'País de origen', max: 60 },
        {
          key: 'fuenteFicha',
          label: 'Fuente de la ficha',
          span: 2,
          max: 300,
          placeholder: 'Página del fabricante o del proveedor de donde se copió',
          hint: 'Solo la ve el personal: no sale en el catálogo.',
        },
      ],
    },
    {
      title: 'Primera medida (opcional)',
      fields: camposMedida(medidas, { requerida: false }).map((f) => ({ ...f, only: 'create' })),
    },
    {
      title: 'Estado',
      fields: [{ key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] }],
    },
    {
      title: 'Foto',
      fields: [
        {
          key: 'foto',
          label: 'Foto del producto',
          type: 'image',
          span: 2,
          placeholder: 'Sube la foto de la llanta (JPG o PNG). La usan todas sus medidas.',
        },
      ],
    },
  ];
}

/** Formulario de una medida del modelo. */
const seccionesMedida = (medidas) => [
  { title: 'Medida', fields: camposMedida(medidas, { requerida: true }) },
  {
    title: 'Estado',
    fields: [{ key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] }],
  },
];

/** Formulario de la llanta reencauchada: su descripción, vehículo, precio y estado. */
function seccionesReencauchada({ tipos }) {
  return [
    {
      title: 'Llanta reencauchada',
      fields: [
        { key: 'codigo', label: 'Código del producto', only: ['edit', 'view'], soloLectura: true },
        { key: 'llantaReencauche', label: 'Llanta de origen', only: ['edit', 'view'], soloLectura: true },
        { key: 'medidas', label: 'Medida', required: true },
        { key: 'tipoVehiculo', label: 'Tipo de vehículo', type: 'buscador', options: tipos.map((t) => t.nombre) },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2, max: 200 },
        {
          key: 'precioVenta',
          label: 'Precio de venta (COP)',
          type: 'money',
          required: true,
          hint: 'Es una sola unidad con precio fijo. Sin precio no se ofrece en el catálogo.',
        },
        { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo },
      ],
    },
  ];
}

// ---- Piezas de la tabla -------------------------------------------------------

const etiqueta = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold';

const columnasModelo = [
  {
    key: 'nombre',
    label: 'Producto',
    render: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{row.nombre}</span>
        {!row.foto && (
          <span title="El producto no tiene foto" className={`${etiqueta} bg-amber-400/15 text-amber-600 dark:text-amber-400`}>
            <TriangleAlert size={10} aria-hidden="true" /> Sin foto
          </span>
        )}
      </span>
    ),
  },
  { key: 'marca', label: 'Marca' },
  { key: 'categoria', label: 'Categoría' },
  {
    key: 'medidas',
    label: 'Medidas',
    render: (row) =>
      row.referencias.length === 0 ? (
        <span className="text-xs text-slate-400">Sin medidas</span>
      ) : (
        <span className="block max-w-[16rem]">
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {row.referencias.length} {row.referencias.length === 1 ? 'medida' : 'medidas'}
          </span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{row.medidas}</span>
        </span>
      ),
    exportar: (row) => row.medidas ?? '',
  },
  { key: 'estado', label: 'Estado' },
];

const columnasReencauchada = [
  {
    key: 'nombre',
    label: 'Llanta',
    render: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        {row.descripcion || row.nombre}
        <span
          title={row.llantaReencauche ? `Llanta ${row.llantaReencauche}` : 'Llanta reencauchada'}
          className={`${etiqueta} bg-slate-500/15 text-slate-600 dark:text-slate-300`}
        >
          {row.reservada ? 'Apartada' : row.precioVentaValor ? 'Única' : 'Sin precio'}
        </span>
      </span>
    ),
  },
  { key: 'codigo', label: 'Código' },
  { key: 'medidas', label: 'Medida' },
  { key: 'precioVenta', label: 'Precio', render: (row) => (row.precioVenta ? `$ ${row.precioVenta}` : '—') },
  { key: 'estado', label: 'Estado' },
];

/** Dato de una medida, o un guion si no se ha cargado. */
const dato = (valor, unidad = '') => (valor === null || valor === undefined || valor === '' ? '—' : `${valor}${unidad}`);

/** Medidas de un modelo, bajo su fila. */
function MedidasDelModelo({ modelo, onNueva, onEditar, onEstado }) {
  return (
    <div className="space-y-3">
      {modelo.referencias.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
          Este producto todavía no tiene medidas. Agrega la primera para poder cotizarlo.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200/70 rounded-xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-brand-navy-800">
          {modelo.referencias.map((r) => (
            <li
              key={r.id}
              className="grid items-center gap-x-5 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_auto]"
            >
              <div className="min-w-0">
                <p className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{r.medidas}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {r.codigo}
                  {r.codigoFabricante ? ` · Fab. ${r.codigoFabricante}` : ''}
                </p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Índice de carga <span className="block font-semibold tabular-nums text-slate-700 dark:text-slate-200">{dato(r.indiceCarga)}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lonas · labrado
                <span className="block font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {r.lonasValor || r.profundidadValor
                    ? `${dato(r.lonasValor, ' PR')} · ${dato(r.profundidadValor?.toLocaleString('es-CO'), ' mm')}`
                    : '—'}
                </span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Peso <span className="block font-semibold tabular-nums text-slate-700 dark:text-slate-200">{dato(r.pesoValor?.toLocaleString('es-CO'), ' kg')}</span>
              </p>
              <div className="flex items-center justify-end gap-2">
                <StatusSwitch value={r.estado} options={estadosActivo} onChange={(estado) => onEstado(r, estado)} label={`Estado de ${r.medidas}`} />
                <BotonAccion icono={Pencil} etiqueta={`Editar la medida ${r.medidas}`} accion="editar" onClick={() => onEditar(r)} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onNueva}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-400/10 dark:text-amber-400"
      >
        <Plus size={14} aria-hidden="true" /> Agregar medida
      </button>
    </div>
  );
}

export default function ProductosPage() {
  // Listas para los selects del formulario
  const categorias = useRecurso(categoriasService);
  const marcas = useRecurso(marcasService);
  const tipos = useRecurso(tiposVehiculoService);
  const modelos = useRecurso(modelosService);
  // Todas las medidas del catálogo (con sus datos), para agruparlas por modelo
  const referencias = useRecurso(referenciasService);
  const productos = useRecurso(productosService);

  // { modelo, referencia? } del formulario de medida abierto
  const [medidaAbierta, setMedidaAbierta] = useState(null);
  const [errorMedida, setErrorMedida] = useState('');

  const contexto = { categorias: categorias.filas, marcas: marcas.filas, tipos: tipos.filas };

  // Cada modelo con sus medidas. El de las reencauchadas va en su propia tabla.
  const filasModelos = useMemo(() => {
    const porModelo = new Map();
    for (const r of referencias.filas) {
      if (r.reencauchada) continue;
      porModelo.set(r.modeloId, [...(porModelo.get(r.modeloId) ?? []), r]);
    }
    return modelos.filas.filter((m) => !m.deReencauchadas).map((m) => ({ ...m, referencias: porModelo.get(m.id) ?? [] }));
  }, [modelos.filas, referencias.filas]);

  const reencauchadas = useMemo(() => productos.filas.filter((p) => p.reencauchada), [productos.filas]);

  // Medidas registradas, sin repetir (buscador de medidas)
  const medidas = useMemo(
    () => [...new Set(referencias.filas.filter((r) => !r.reencauchada).map((r) => r.medidas))].sort(),
    [referencias.filas],
  );

  /** Ejecuta un cambio y recarga los modelos y sus medidas. */
  const guardar = async (operacion) => {
    const resultado = await operacion();
    await Promise.all([modelos.recargar(), referencias.recargar()]);
    return resultado;
  };

  const cambiarEstadoMedida = async (modelo, referencia, estado) => {
    setErrorMedida('');
    try {
      await guardar(() => modelosService.cambiarEstadoReferencia(modelo, referencia, estado));
    } catch (e) {
      setErrorMedida(e.message);
    }
  };

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Productos']} />
      <AvisoError mensaje={errorMedida} />
      <DataTable
        title="Productos"
        columns={columnasModelo}
        data={filasModelos}
        cargando={modelos.cargando || referencias.cargando}
        error={modelos.error || referencias.error}
        onRecargar={() => Promise.all([modelos.recargar(), referencias.recargar()])}
        onCreate={(valores) => guardar(() => modelosService.crear(valores, contexto))}
        onEdit={(fila, valores) => guardar(() => modelosService.editar(fila, valores, contexto))}
        onStatusChange={(fila, estado) => guardar(() => modelosService.cambiarEstado(fila, estado))}
        newLabel="Nuevo producto"
        formSections={seccionesModelo({ categorias: categorias.filas, marcas: marcas.filas, tipos: tipos.filas, medidas })}
        entityName="producto"
        exportable={false}
        // Un producto con ventas o compras no se borra: se desactiva
        canDelete={false}
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        expandir={(m) => (
          <MedidasDelModelo
            modelo={m}
            onNueva={() => setMedidaAbierta({ modelo: m })}
            onEditar={(referencia) => setMedidaAbierta({ modelo: m, referencia })}
            onEstado={(referencia, estado) => cambiarEstadoMedida(m, referencia, estado)}
          />
        )}
        filters={[
          { key: 'categoria', label: 'Categoría', options: categorias.filas.map((c) => c.nombre) },
          { key: 'marca', label: 'Marca', options: marcas.filas.map((m) => m.nombre) },
          { key: 'tipoVehiculo', label: 'Vehículo', options: tipos.filas.map((t) => t.nombre) },
          { key: 'estado', label: 'Estado', options: estadosActivo },
        ]}
      />
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Despliega cada producto para ver, agregar o desactivar sus medidas. Lo que cambies en el producto (nombre, ficha, foto)
        pasa a todas sus medidas.
      </p>

      {(reencauchadas.length > 0 || productos.cargando) && (
        <div className="mt-10">
          <DataTable
            title="Llantas reencauchadas"
            columns={columnasReencauchada}
            data={reencauchadas}
            cargando={productos.cargando}
            error={productos.error}
            onRecargar={productos.recargar}
            onEdit={(fila, valores) => productos.editar(fila, { ...fila, ...valores }, contexto)}
            onStatusChange={(fila, estado) => productos.ejecutar(() => productosService.cambiarEstado(fila, estado))}
            formSections={seccionesReencauchada({ tipos: tipos.filas })}
            entityName="llanta reencauchada"
            entityGender="f"
            titleKey="descripcion"
            exportable={false}
            canDelete={false}
            statusKey="estado"
            statusOptions={estadosActivo}
            statusVariant="switch"
          />
        </div>
      )}

      {medidaAbierta && (
        <FormModal
          title={medidaAbierta.referencia ? 'Editar medida' : 'Nueva medida'}
          subtitle={`${medidaAbierta.modelo.marca} ${medidaAbierta.modelo.nombre}`}
          mode={medidaAbierta.referencia ? 'edit' : 'create'}
          size="md"
          sections={seccionesMedida(medidas)}
          initialValues={medidaAbierta.referencia ?? {}}
          resumen={medidaAbierta.referencia ? { titulo: medidaAbierta.referencia.medidas, estado: medidaAbierta.referencia.estado } : undefined}
          onSubmit={(valores) =>
            guardar(() =>
              medidaAbierta.referencia
                ? modelosService.editarReferencia(medidaAbierta.modelo, medidaAbierta.referencia, valores)
                : modelosService.crearReferencia(medidaAbierta.modelo, valores),
            )
          }
          onClose={() => setMedidaAbierta(null)}
        />
      )}
    </div>
  );
}
