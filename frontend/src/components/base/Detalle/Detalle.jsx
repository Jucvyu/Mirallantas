import { ExternalLink, ImageOff, Package, TriangleAlert, Wrench } from 'lucide-react';
import Badge from '../Badge';
import { SkeletonLineas } from '../Skeleton';

// =========================================================================
// Piezas de los modales de "ver detalle". Todos se leen igual: primero el
// resumen (lo que más importa y su estado) y debajo los datos por secciones,
// como texto y no como campos de formulario, porque ahí nada se edita.
//
//   <DetalleResumen>      valor principal, nota y estado
//   <DetalleSeccion>      título (con icono y acción opcionales) + contenido
//   <DetalleDatos>        lista de etiqueta y valor en dos o cuatro columnas
//   <DetalleAviso>        mensaje resaltado (peligro, atención o información)
//   <DetalleImagen>       comprobante o foto; al pulsarla se abre completa
//   <DetalleLineas>       productos y servicios de un documento
// =========================================================================

/** Valor principal del detalle: un monto, un nombre… junto con su estado. */
export function DetalleResumen({ etiqueta, valor, nota, estado, tonoEstado, icono, children }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.14] via-amber-400/[0.05] to-transparent px-5 py-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {icono && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-base font-bold text-amber-600 dark:text-amber-400">
            {icono}
          </span>
        )}
        <div className="min-w-0">
          {etiqueta && <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{etiqueta}</p>}
          <p className={`break-words font-bold tracking-tight text-slate-900 dark:text-white ${icono ? 'text-lg' : 'text-[1.75rem] leading-tight'}`}>
            {valor}
          </p>
          {nota && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{nota}</p>}
        </div>
      </div>
      {estado && <Badge tone={tonoEstado}>{estado}</Badge>}
      {children}
    </section>
  );
}

/** Bloque del detalle con su título. */
export function DetalleSeccion({ titulo, icono, accion, children }) {
  return (
    <section>
      {(titulo || accion) && (
        <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {icono && <span className="text-amber-500 dark:text-amber-400">{icono}</span>}
            {titulo}
          </h4>
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * Lista de datos: `datos` = [{ etiqueta, valor, ancho }] (`ancho` ocupa toda la
 * fila). Los elementos vacíos del arreglo se ignoran, para poder escribir
 * `condicion && { … }`; un valor vacío se muestra como "—".
 */
export function DetalleDatos({ datos, columnas = 2 }) {
  const grilla = columnas === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2';
  return (
    <dl className={`grid gap-x-6 ${grilla}`}>
      {datos.filter(Boolean).map(({ etiqueta, valor, ancho }) => (
        <div
          key={etiqueta}
          className={`min-w-0 border-t border-slate-100 py-2.5 dark:border-white/[0.07] ${ancho ? 'col-span-full' : ''}`}
        >
          <dt className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
            {valor === '' || valor === null || valor === undefined ? <span className="font-normal text-slate-400">—</span> : valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const TONOS_AVISO = {
  peligro: 'border-red-400/40 bg-red-500/[0.07] text-red-600 dark:text-red-400',
  atencion: 'border-amber-400/40 bg-amber-400/[0.08] text-amber-700 dark:text-amber-300',
  info: 'border-blue-400/30 bg-blue-500/[0.07] text-blue-700 dark:text-blue-300',
};

/** Mensaje resaltado dentro de un detalle. */
export function DetalleAviso({ tono = 'atencion', icono, children }) {
  return (
    <p className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium leading-relaxed ${TONOS_AVISO[tono]}`}>
      <span className="mt-px shrink-0">{icono ?? <TriangleAlert size={15} />}</span>
      <span>{children}</span>
    </p>
  );
}

/** Comprobante o foto, completa y sin recortar: es la prueba que se revisa. */
export function DetalleImagen({ src, alt, vacio = 'Sin imagen adjunta.' }) {
  if (!src) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-xs text-slate-400 dark:border-white/10">
        <ImageOff size={20} strokeWidth={1.5} />
        {vacio}
      </div>
    );
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      title="Abrir la imagen completa"
      className="group relative block overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5"
    >
      <img src={src} alt={alt} className="max-h-80 w-full object-contain" />
      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <ExternalLink size={11} /> Abrir
      </span>
    </a>
  );
}

/**
 * Productos y servicios de una cotización o venta. `lineas` viene de
 * lineaDesdeApi; `notaDe(linea)` agrega un texto bajo el nombre de cada una.
 */
export function DetalleLineas({ lineas = [], cargando = false, vacio = 'Sin líneas registradas.', notaDe }) {
  if (lineas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400 dark:border-white/10">
        {cargando ? <SkeletonLineas lineas={3} /> : vacio}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/[0.07] dark:border-white/10">
      {lineas.map((l, i) => {
        const esServicio = l.tipo === 'servicio';
        const meta = [l.codigo, l.medida, l.solicitud].filter(Boolean).join(' · ');
        return (
          <li key={l.lineaId ?? i} className="flex items-start gap-3 px-4 py-3">
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                esServicio ? 'bg-blue-500/15 text-blue-500 dark:text-blue-400' : 'bg-amber-400/15 text-amber-500 dark:text-amber-400'
              }`}
            >
              {esServicio ? <Wrench size={14} /> : <Package size={14} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{l.nombre}</p>
              {meta && <p className="text-xs text-slate-400 dark:text-slate-500">{meta}</p>}
              {notaDe?.(l)}
            </div>
            <div className="shrink-0 text-right">
              <p className="whitespace-nowrap text-sm font-semibold text-slate-800 dark:text-slate-100">{l.subtotal}</p>
              <p className="whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">
                {l.cantidad} × {!esServicio && l.precioUnitarioValor === null ? 'por confirmar' : l.unitario}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
