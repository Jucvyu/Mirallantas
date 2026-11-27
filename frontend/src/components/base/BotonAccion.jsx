import Tooltip from './Tooltip';
import { useProcesando } from '../../hooks/useProcesando';
import { usePrivilegio } from '../../hooks/usePrivilegio';
import { NOMBRE_ACCION } from '../../privilegios';

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
 *   <BotonAccion icono={Ban} etiqueta="Anular la venta" tono="peligro" accion="anular"
 *     deshabilitado={row.estado === 'Anulada'} motivo="La venta ya está anulada"
 *     onClick={…} />
 *
 * `accion` (nivel 3 de seguridad): si el rol la tiene negada en el módulo de
 * la pantalla, el botón queda deshabilitado y lo explica.
 *
 * Si `onClick` devuelve una promesa (una petición a la API), mientras
 * responde el icono se ve como un skeleton y el botón no recibe más clics.
 */
export default function BotonAccion({ icono: Icono, etiqueta, onClick, tono = 'neutro', deshabilitado = false, motivo, accion }) {
  const puede = usePrivilegio();
  const [procesando, ejecutar] = useProcesando(onClick);
  if (accion && !puede(accion)) {
    deshabilitado = true;
    motivo = `Tu rol no tiene permiso para: ${NOMBRE_ACCION[accion] ?? accion}`;
  }
  const titulo = deshabilitado ? `${etiqueta} · ${motivo ?? 'No disponible'}` : etiqueta;
  if (procesando) {
    return (
      <span role="status" aria-label={`${etiqueta}: procesando`} className="inline-flex shrink-0 cursor-wait p-0.5">
        <span aria-hidden="true" className="block h-[15px] w-[15px] animate-pulse rounded bg-slate-200 dark:bg-white/10" />
        <span className="sr-only">Procesando</span>
      </span>
    );
  }
  return (
    <Tooltip texto={titulo} className={deshabilitado ? 'cursor-not-allowed' : ''}>
      <button
        type="button"
        onClick={deshabilitado ? undefined : (e) => ejecutar(e)}
        disabled={deshabilitado}
        aria-label={titulo}
        className={`shrink-0 rounded p-0.5 transition-colors ${
          deshabilitado ? 'pointer-events-none text-slate-300 dark:text-slate-600' : TONOS[tono]
        }`}
      >
        <Icono size={15} />
      </button>
    </Tooltip>
  );
}
