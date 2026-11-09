import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BORDER_ERR, BORDER_OK, INPUT } from '../formStyles';

/** "A, B, C" → ['A', 'B', 'C'] */
const aLista = (valor) =>
  String(valor ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Campo de etiquetas: una lista corta de valores que se escriben uno por
 * uno (por ejemplo, las medidas de llanta compatibles con una banda).
 *
 * - Enter, coma o salir del campo agregan lo escrito; Retroceso con el campo
 *   vacío quita la última.
 * - `options` sugiere valores conocidos mientras se escribe.
 * - El valor viaja como texto separado por comas, igual que los checkboxes.
 */
export default function Etiquetas({ id, value, options = [], readOnly, error, placeholder, normalizar, onChange, onBlur }) {
  const lista = aLista(value);
  const [texto, setTexto] = useState('');
  const entrada = useRef(null);
  const limpiar = normalizar ?? ((t) => t.trim());

  const agregar = (bruto) => {
    const nuevos = [...new Set(String(bruto).split(',').map(limpiar).filter(Boolean))].filter((v) => !lista.includes(v));
    if (nuevos.length) onChange([...lista, ...nuevos].join(', '));
    setTexto('');
  };
  const quitar = (v) => onChange(lista.filter((x) => x !== v).join(', '));
  const sugerencias = options.filter((o) => !lista.includes(o));

  return (
    <div
      onClick={() => entrada.current?.focus()}
      role="presentation"
      className={`${INPUT} ${error ? BORDER_ERR : BORDER_OK} flex min-h-[46px] flex-wrap items-center gap-1.5 !py-2 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-400/30 ${
        readOnly ? 'cursor-default' : 'cursor-text'
      }`}
    >
      {lista.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
        >
          {v}
          {!readOnly && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                quitar(v);
              }}
              aria-label={`Quitar ${v}`}
              className="rounded text-amber-700/70 hover:text-red-500 dark:text-amber-300/70"
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      {readOnly && lista.length === 0 && <span className="text-sm text-slate-400">—</span>}
      {!readOnly && (
        <input
          ref={entrada}
          id={id}
          list={`${id}-opciones`}
          value={texto}
          placeholder={lista.length ? 'Agregar otra…' : placeholder}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            const t = e.target.value;
            if (t.includes(',')) agregar(t);
            else setTexto(t);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar(texto);
            } else if (e.key === 'Backspace' && !texto && lista.length) {
              quitar(lista[lista.length - 1]);
            }
          }}
          onBlur={() => {
            if (texto.trim()) agregar(texto);
            onBlur?.();
          }}
          className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-sm font-medium outline-none placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
        />
      )}
      <datalist id={`${id}-opciones`}>
        {sugerencias.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
