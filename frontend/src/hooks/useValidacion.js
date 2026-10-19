import { useState } from 'react';

/**
 * Validación en tiempo real para los formularios hechos a mano (los que no
 * usan FormModal).
 *
 *   const { errores, tocar, validar } = useValidacion(() => {
 *     const e = {};
 *     if (!monto) e.monto = 'Indica el monto';
 *     return e;
 *   });
 *
 *   <input onChange={(ev) => { setMonto(ev.target.value); tocar('monto'); }} onBlur={() => tocar('monto')} />
 *   {errores.monto && <p>{errores.monto}</p>}
 *   const guardar = () => { if (!validar()) return; … };
 *
 * - Las reglas se vuelven a revisar en cada cambio, así el aviso aparece o
 *   desaparece mientras el usuario escribe.
 * - Un campo muestra su aviso cuando el usuario lo toca; al intentar guardar
 *   se muestran todos.
 */
export function useValidacion(reglas) {
  const [tocados, setTocados] = useState(() => new Set());
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const pendientes = reglas();
  const errores = mostrarTodos
    ? pendientes
    : Object.fromEntries(Object.entries(pendientes).filter(([campo]) => tocados.has(campo)));

  /** Marca un campo como tocado: desde ahora muestra su aviso. */
  const tocar = (campo) => setTocados((t) => (t.has(campo) ? t : new Set(t).add(campo)));

  /** Muestra todos los avisos y dice si el formulario está listo para enviar. */
  const validar = () => {
    setMostrarTodos(true);
    return Object.keys(pendientes).length === 0;
  };

  return { errores, tocar, validar };
}
