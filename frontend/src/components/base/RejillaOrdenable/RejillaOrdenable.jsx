import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripHorizontal, RotateCcw } from 'lucide-react';
import { EASE_OUT } from '../../../utils/movimiento';

/** Reacomodo y asentado: 200 ms con la curva ease-out fuerte de la app. */
const TRANSICION = { duration: 200, easing: EASE_OUT };

/** Lee el orden guardado; si falla o está incompleto, completa con el de por defecto. */
function leerOrden(clave, defecto) {
  try {
    const guardado = JSON.parse(window.localStorage.getItem(clave));
    if (Array.isArray(guardado)) {
      const validos = guardado.filter((id) => defecto.includes(id));
      return [...validos, ...defecto.filter((id) => !validos.includes(id))];
    }
  } catch {
    // almacenamiento bloqueado o dato corrupto: orden por defecto
  }
  return defecto;
}

function guardarOrden(clave, orden) {
  try {
    window.localStorage.setItem(clave, JSON.stringify(orden));
  } catch {
    // sin almacenamiento: el orden dura solo esta visita
  }
}

function borrarOrden(clave) {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    // nada que borrar
  }
}

/** Flechas del teclado → paso en el orden (derecha/abajo: siguiente; izquierda/arriba: anterior). */
const PASO_TECLA = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Movimiento con teclado en orden lineal. El cálculo 2D de dnd-kit elige mal
 * en rejillas con tarjetas de alturas distintas (una tarjeta 3 px más a la
 * derecha cuenta como "a la derecha"); el orden lineal es predecible y es lo
 * que se anuncia al lector de pantalla.
 */
function coordenadasLineales(orden) {
  return (evento, { context: { active, over, droppableRects } }) => {
    const paso = PASO_TECLA[evento.code];
    if (!paso || !active) return undefined;
    evento.preventDefault();
    const actual = over?.id ?? active.id;
    const destino = orden[orden.indexOf(actual) + paso];
    const rect = destino !== undefined ? droppableRects.get(destino) : null;
    return rect ? { x: rect.left, y: rect.top } : undefined;
  };
}

/** Un bloque de la rejilla: se arrastra solo desde su asa. */
function Bloque({ id, etiqueta, clase, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: TRANSICION,
    // dnd-kit anuncia "sortable" (en inglés) si no se le da el rol en español
    attributes: { roleDescription: 'tarjeta ordenable' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative min-w-0 ${clase ?? ''} ${isDragging ? 'ml-hueco' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="ml-asa"
        aria-label={`Mover la tarjeta ${etiqueta}`}
        {...attributes}
        {...listeners}
      >
        <GripHorizontal size={16} aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

/**
 * Rejilla de tarjetas que se reordenan arrastrándolas por su asa.
 *
 * - Ratón: arrastre desde el asa (los botones y enlaces de la tarjeta
 *   funcionan con clic normal). Táctil: pulsación larga de 250 ms en el asa,
 *   para no robarle el gesto al scroll. Teclado: espacio o enter para tomar,
 *   flechas para mover al lugar siguiente o anterior, espacio o enter para
 *   soltar y Escape para cancelar.
 * - El orden se guarda en localStorage con `claveAlmacen` (una por usuario);
 *   nunca en la base de datos.
 *
 * props:
 *   bloques       [{ id, etiqueta, clase, contenido }] en el orden por defecto
 *   claveAlmacen  clave de localStorage
 *   className     clases de la rejilla (columnas y separación)
 */
export default function RejillaOrdenable({ bloques, claveAlmacen, className = '' }) {
  const defecto = useMemo(() => bloques.map((b) => b.id), [bloques]);
  const [ordenGuardado, setOrdenGuardado] = useState(() => leerOrden(claveAlmacen, defecto));
  const [activo, setActivo] = useState(null);

  // Si cambian los bloques visibles, el orden se ajusta sin perder lo guardado
  const orden = useMemo(() => {
    const validos = ordenGuardado.filter((id) => defecto.includes(id));
    return [...validos, ...defecto.filter((id) => !validos.includes(id))];
  }, [ordenGuardado, defecto]);
  const porId = useMemo(() => Object.fromEntries(bloques.map((b) => [b.id, b])), [bloques]);
  const nombre = useCallback((id) => porId[id]?.etiqueta ?? id, [porId]);
  const esDefecto = orden.every((id, i) => id === defecto[i]);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasLineales(orden) }),
  );

  const anuncios = useMemo(
    () => ({
      onDragStart: ({ active }) => `Tomaste la tarjeta ${nombre(active.id)}.`,
      onDragOver: ({ active, over }) =>
        over ? `${nombre(active.id)} está en el lugar de ${nombre(over.id)}.` : `${nombre(active.id)} no está sobre ningún lugar.`,
      onDragEnd: ({ active, over }) =>
        over ? `Soltaste ${nombre(active.id)} en el lugar de ${nombre(over.id)}.` : `Soltaste ${nombre(active.id)}.`,
      onDragCancel: ({ active }) => `Movimiento cancelado. ${nombre(active.id)} volvió a su lugar.`,
    }),
    [nombre],
  );

  const terminar = () => {
    setActivo(null);
    delete document.body.dataset.arrastrando;
  };

  const alSoltar = ({ active, over }) => {
    terminar();
    if (!over || active.id === over.id) return;
    const nuevo = arrayMove(orden, orden.indexOf(active.id), orden.indexOf(over.id));
    setOrdenGuardado(nuevo);
    guardarOrden(claveAlmacen, nuevo);
  };

  const restablecer = () => {
    setOrdenGuardado(defecto);
    borrarOrden(claveAlmacen);
  };

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={restablecer}
          disabled={esDefecto}
          className="ml-pulsable inline-flex items-center gap-1.5 rounded-[14px] px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-brand-blue disabled:cursor-default disabled:opacity-0 dark:text-slate-400 dark:hover:text-white"
        >
          <RotateCcw size={13} aria-hidden="true" /> Restablecer orden
        </button>
      </div>

      <DndContext
        sensors={sensores}
        collisionDetection={closestCenter}
        accessibility={{
          announcements: anuncios,
          screenReaderInstructions: {
            draggable:
              'Para mover la tarjeta, pulsa espacio o enter. Usa las flechas para llevarla a otro lugar y espacio o enter para soltarla. Escape cancela.',
          },
        }}
        onDragStart={({ active }) => {
          setActivo(active.id);
          // Mientras se arrastra, ninguna tarjeta se inclina con el cursor
          document.body.dataset.arrastrando = '';
        }}
        onDragEnd={alSoltar}
        onDragCancel={terminar}
      >
        <SortableContext items={orden} strategy={rectSortingStrategy}>
          <div className={className}>
            {orden.map((id) => (
              <Bloque key={id} id={id} etiqueta={porId[id].etiqueta} clase={porId[id].clase}>
                {porId[id].contenido}
              </Bloque>
            ))}
          </div>
        </SortableContext>

        {/* Copia que sigue al cursor: levantada, sin inclinación. Va en un
            portal a <body>: si un ancestro tiene transform (la animación de
            entrada de la vista), un `position: fixed` dentro de él quedaría
            desplazado del cursor y el destino se calcularía mal. */}
        {createPortal(
          <DragOverlay dropAnimation={TRANSICION}>
            {activo ? <div className="ml-levantada h-full">{porId[activo]?.contenido}</div> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </div>
  );
}
