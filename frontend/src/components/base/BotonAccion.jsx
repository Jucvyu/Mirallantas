/** Color del icono según la acción (el gris es el de siempre). */
const TONOS = {
  neutro: 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
  acento: 'text-slate-400 hover:text-amber-500',
  destacado: 'text-amber-500 hover:text-amber-600 dark:text-amber-400',
  exito: 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400',
  peligro: 'text-red-500 hover:text-red-600',
};

/**
 * Botón de acción de una fila (un icono).
 *
 * Siempre se muestra, para que todas las filas tengan los mismos iconos en
 * el mismo lugar. Si la acción no aplica a esa fila, queda deshabilitado
 * (atenuado y sin clic) y al pasar el mouse dice por qué.
 *
 *   <BotonAccion icono={Ban} etiqueta="Anular la venta" tono="peligro"
 *     deshabilitado={row.estado === 'Anulada'} motivo="La venta ya está anulada"
 *     onClick={…} />
 */
export default function BotonAccion({ icono: Icono, etiqueta, onClick, tono = 'neutro', deshabilitado = false, motivo }) {
  const titulo = deshabilitado ? `${etiqueta} · ${motivo ?? 'No disponible'}` : etiqueta;
  return (
    <button
      type="button"
      onClick={deshabilitado ? undefined : onClick}
      disabled={deshabilitado}
      aria-label={titulo}
      title={titulo}
      className={`shrink-0 rounded p-0.5 transition-colors ${
        deshabilitado ? 'cursor-not-allowed text-slate-300 dark:text-slate-600' : TONOS[tono]
      }`}
    >
      <Icono size={15} />
    </button>
  );
}
