import { Check } from 'lucide-react';
import { MODULOS_PORTAL } from '../../../permisos';

/** Columnas de la matriz: ver es tener el módulo; las demás, el nivel 3. */
const COLUMNAS = [
  { accion: 'ver', titulo: 'Ver' },
  { accion: 'crear', titulo: 'Crear' },
  { accion: 'editar', titulo: 'Editar' },
  { accion: 'eliminar', titulo: 'Eliminar' },
];

/** Módulos que solo se consultan: no tienen nada que crear, editar o eliminar. */
const SOLO_VER = new Set(['Dashboard', ...MODULOS_PORTAL.map((m) => m.permiso)]);

/**
 * Matriz de módulos × privilegios para el formulario de roles (nivel 3 de
 * seguridad). Valor: { Clientes: { ver, crear, editar, eliminar }, … }.
 *
 * Marcar crear, editar o eliminar marca también ver; quitar ver quita todo.
 * Pulsar el nombre del módulo lo marca (o desmarca) completo.
 */
export default function MatrizPrivilegios({ id, grupos, valor = {}, soloLectura, error, onChange }) {
  const de = (modulo) => valor[modulo] ?? { ver: false, crear: false, editar: false, eliminar: false };

  const cambiar = (modulo, accion) => {
    const actual = de(modulo);
    const marcado = !actual[accion];
    let nuevo;
    if (accion === 'ver') {
      nuevo = marcado
        ? { ver: true, crear: !SOLO_VER.has(modulo), editar: !SOLO_VER.has(modulo), eliminar: !SOLO_VER.has(modulo) }
        : { ver: false, crear: false, editar: false, eliminar: false };
    } else {
      nuevo = { ...actual, [accion]: marcado, ver: marcado ? true : actual.ver };
    }
    onChange({ ...valor, [modulo]: nuevo });
  };

  const alternarModulo = (modulo) => {
    const todo = de(modulo).ver && (SOLO_VER.has(modulo) || ['crear', 'editar', 'eliminar'].every((a) => de(modulo)[a]));
    const marcar = !todo;
    onChange({
      ...valor,
      [modulo]: { ver: marcar, crear: marcar && !SOLO_VER.has(modulo), editar: marcar && !SOLO_VER.has(modulo), eliminar: marcar && !SOLO_VER.has(modulo) },
    });
  };

  return (
    <div id={id} className={`overflow-x-auto rounded-xl border ${error ? 'border-red-400' : 'border-slate-200 dark:border-white/10'}`}>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-brand-navy-900">
          <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <th className="px-3 py-2">Módulo</th>
            {COLUMNAS.map(({ titulo }) => (
              <th key={titulo} className="w-16 px-2 py-2 text-center">
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => [
            grupo.titulo && (
              <tr key={`g-${grupo.titulo}`} className="border-t border-slate-100 dark:border-white/5">
                <td colSpan={5} className="bg-slate-50/60 px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:bg-white/[0.02] dark:text-slate-500">
                  {grupo.titulo}
                </td>
              </tr>
            ),
            ...grupo.opciones.map((modulo) => (
              <tr key={modulo} className="border-t border-slate-100 dark:border-white/5">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={soloLectura}
                    onClick={() => alternarModulo(modulo)}
                    className={`text-left font-medium ${de(modulo).ver ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'} ${
                      soloLectura ? 'cursor-default' : 'hover:text-amber-600 dark:hover:text-amber-400'
                    }`}
                  >
                    {modulo}
                  </button>
                </td>
                {COLUMNAS.map(({ accion, titulo }) => {
                  const aplica = accion === 'ver' || !SOLO_VER.has(modulo);
                  const marcado = de(modulo)[accion];
                  return (
                    <td key={accion} className="px-2 py-2 text-center">
                      {aplica ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={marcado}
                          aria-label={`${titulo} en ${modulo}`}
                          disabled={soloLectura}
                          onClick={() => cambiar(modulo, accion)}
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                            marcado
                              ? 'border-amber-400 bg-amber-400 text-slate-900'
                              : 'border-slate-300 bg-white dark:border-white/20 dark:bg-brand-navy-900'
                          } ${soloLectura ? 'cursor-default' : 'hover:border-amber-400'}`}
                        >
                          {marcado && <Check size={13} strokeWidth={3} />}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600" aria-hidden="true">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}
