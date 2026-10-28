import { Check } from 'lucide-react';
import { accionesDe, NOMBRE_ACCION } from '../../../privilegios';

/**
 * Módulos y acciones de un rol (nivel 3 de seguridad).
 *
 * Valor: { Clientes: { ver: true, denegadas: ['eliminar'] }, … }.
 * "Ver" da el módulo (aparece en el menú); cada acción del módulo (ver
 * detalle, crear, editar, cambiar estado, eliminar, exportar y las propias
 * como anular o emitir) se enciende o se apaga. Pulsar el nombre del
 * módulo lo activa con todas sus acciones (o lo quita).
 */
export default function MatrizPrivilegios({ id, grupos, valor = {}, soloLectura, error, onChange }) {
  const de = (modulo) => valor[modulo] ?? { ver: false, denegadas: [] };

  const alternarVer = (modulo) => {
    const actual = de(modulo);
    onChange({ ...valor, [modulo]: { ver: !actual.ver, denegadas: actual.ver ? [] : actual.denegadas } });
  };

  const alternarAccion = (modulo, accion) => {
    const actual = de(modulo);
    if (!actual.ver) return;
    const denegadas = actual.denegadas.includes(accion)
      ? actual.denegadas.filter((a) => a !== accion)
      : [...actual.denegadas, accion];
    onChange({ ...valor, [modulo]: { ...actual, denegadas } });
  };

  /** El nombre del módulo: completo (ver y todas sus acciones) o nada. */
  const alternarModulo = (modulo) => {
    const actual = de(modulo);
    const completo = actual.ver && actual.denegadas.length === 0;
    onChange({ ...valor, [modulo]: { ver: !completo, denegadas: [] } });
  };

  return (
    <div id={id} className={`overflow-hidden rounded-xl border ${error ? 'border-red-400' : 'border-slate-200 dark:border-white/10'}`}>
      {grupos.map((grupo) => (
        <div key={grupo.titulo ?? 'todos'}>
          {grupo.titulo && (
            <p className="border-b border-slate-100 bg-slate-50/70 px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-500">
              {grupo.titulo}
            </p>
          )}
          {grupo.opciones.map((modulo) => {
            const { ver, denegadas } = de(modulo);
            const acciones = accionesDe(modulo);
            return (
              <div key={modulo} className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0 dark:border-white/5 sm:flex-row sm:items-start">
                {/* Ver (tener el módulo) */}
                <div className="flex w-full shrink-0 items-center gap-2 sm:w-48">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={ver}
                    aria-label={`Ver ${modulo}`}
                    disabled={soloLectura}
                    onClick={() => alternarVer(modulo)}
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      ver ? 'border-amber-400 bg-amber-400 text-slate-900' : 'border-slate-300 bg-white dark:border-white/20 dark:bg-brand-navy-900'
                    } ${soloLectura ? 'cursor-default' : 'hover:border-amber-400'}`}
                  >
                    {ver && <Check size={13} strokeWidth={3} />}
                  </button>
                  <button
                    type="button"
                    disabled={soloLectura}
                    onClick={() => alternarModulo(modulo)}
                    className={`text-left text-sm font-medium ${ver ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'} ${
                      soloLectura ? 'cursor-default' : 'hover:text-amber-600 dark:hover:text-amber-400'
                    }`}
                  >
                    {modulo}
                  </button>
                </div>

                {/* Acciones del módulo */}
                {acciones.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {acciones.map((accion) => {
                      const permitida = ver && !denegadas.includes(accion);
                      return (
                        <button
                          key={accion}
                          type="button"
                          role="switch"
                          aria-checked={permitida}
                          aria-label={`${NOMBRE_ACCION[accion]} en ${modulo}`}
                          disabled={soloLectura || !ver}
                          onClick={() => alternarAccion(modulo, accion)}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            permitida
                              ? 'border-amber-400/70 bg-amber-400/15 text-amber-700 dark:text-amber-300'
                              : 'border-slate-200 text-slate-400 line-through dark:border-white/10 dark:text-slate-500'
                          } ${soloLectura || !ver ? 'cursor-default opacity-60' : 'hover:border-amber-400'}`}
                        >
                          {NOMBRE_ACCION[accion]}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Solo consulta</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
