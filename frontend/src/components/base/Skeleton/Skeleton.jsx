/**
 * Bloques grises que ocupan el lugar del contenido mientras llegan los
 * datos (en vez del texto "Cargando…"). El lector de pantalla sí escucha
 * "Cargando" gracias al texto oculto de `role="status"`.
 *
 *   <Skeleton className="h-4 w-32" />      un bloque suelto
 *   <SkeletonLineas lineas={3} />          varias barras apiladas
 *   <SkeletonFilas filas={5} columnas={6} />  filas de una <tbody>
 */

/** Un bloque gris con pulso suave. El tamaño va en `className`. */
export default function Skeleton({ className = 'h-4 w-full' }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-slate-200 dark:bg-white/10 ${className}`} />;
}

/** Texto oculto para quien usa lector de pantalla. */
function Anuncio() {
  return <span className="sr-only">Cargando</span>;
}

/** Barras de distinto ancho, como renglones de texto. */
const ANCHOS = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3', 'w-3/4'];

export function SkeletonLineas({ lineas = 3, className = '' }) {
  return (
    <div role="status" className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lineas }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${ANCHOS[i % ANCHOS.length]}`} />
      ))}
      <Anuncio />
    </div>
  );
}

/** Filas de tabla: va directo dentro de <tbody>. */
export function SkeletonFilas({ filas = 5, columnas = 4 }) {
  return Array.from({ length: filas }, (_, f) => (
    <tr key={f} role={f === 0 ? 'status' : undefined}>
      {Array.from({ length: columnas }, (_, c) => (
        <td key={c} className="px-5 py-4">
          <Skeleton className={`h-4 ${ANCHOS[(f + c) % ANCHOS.length]}`} />
          {f === 0 && c === 0 && <Anuncio />}
        </td>
      ))}
    </tr>
  ));
}
