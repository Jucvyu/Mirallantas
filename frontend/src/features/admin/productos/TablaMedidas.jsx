import { useMemo, useState } from 'react';
import { ChevronDown, Copy, Plus, Trash2 } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import StatusSwitch from '../../../components/base/StatusSwitch';
import { BORDER_ERR, BORDER_OK, INPUT, soloDigitos } from '../../../components/base/formStyles';
import { useEnvio } from '../../../hooks/useEnvio';
import { columnasMedida, normalizarMedida } from './camposProducto';

const CELDA = `${INPUT} !h-10 !rounded-lg !px-2.5 !py-1.5 text-sm tabular-nums`;

let siguienteClave = 0;
/** Clave local de una fila (las nuevas aún no tienen id). */
const nuevaClave = () => `n${(siguienteClave += 1)}`;

const texto = (v) => (v === null || v === undefined ? '' : String(v));

/** Filas de la tabla a partir de las medidas guardadas. */
const filasDe = (referencias) =>
  referencias.map((r) => ({
    clave: `r${r.id}`,
    id: r.id,
    codigo: r.codigo,
    medidas: r.medidas,
    posicion: texto(r.posicion),
    indiceCarga: texto(r.indiceCarga),
    lonas: texto(r.lonasValor ?? r.lonas),
    profundidadLabrado: texto(r.profundidadValor ?? r.profundidadLabrado).replace('.', ','),
    pesoKg: texto(r.pesoValor ?? r.pesoKg).replace('.', ','),
    codigoFabricante: texto(r.codigoFabricante),
    activo: r.activo !== false,
  }));

const filaVacia = (base = {}) => ({
  clave: nuevaClave(),
  medidas: '',
  posicion: '',
  indiceCarga: '',
  lonas: '',
  profundidadLabrado: '',
  pesoKg: '',
  codigoFabricante: '',
  activo: true,
  ...base,
});

/** ¿Fila nueva en la que no se ha escrito nada? (no cuenta como cambio ni se envía) */
const enBlanco = (f) =>
  !f.id && ['medidas', 'indiceCarga', 'lonas', 'profundidadLabrado', 'pesoKg', 'codigoFabricante'].every((k) => !String(f[k] ?? '').trim());

/** Lo que se compara para saber si hay cambios sin guardar. */
const firma = (filas) => JSON.stringify(filas.filter((f) => !enBlanco(f)).map(({ clave: _c, codigo: _co, ...resto }) => resto));

/**
 * Tabla de medidas de un producto, como una hoja de cálculo: cada fila es
 * una medida (posición + medida + sus datos) y se escribe directo en las
 * celdas. "Duplicar" copia la fila para cambiar solo la medida. Todo se
 * guarda de una vez; si una medida tiene un error, no se guarda ninguna.
 *
 * Una medida guardada no se borra (puede estar en cotizaciones y ventas):
 * se desactiva. Las filas nuevas sí se pueden quitar antes de guardar.
 *
 *   referencias       medidas guardadas del producto
 *   ocultos           datos que no aplican a la categoría (no se muestran)
 *   medidasExistentes medidas del catálogo, para sugerirlas al escribir
 *   onGuardar(filas)  guarda en la API (devuelve una promesa)
 */
export default function TablaMedidas({ referencias, ocultos, medidasExistentes = [], onGuardar }) {
  const inicial = useMemo(() => filasDe(referencias), [referencias]);
  const [filas, setFilas] = useState(() => (inicial.length ? inicial : [filaVacia()]));
  // Celdas que ya tocó el usuario: solo esas muestran su error (más todas al guardar)
  const [tocadas, setTocadas] = useState(() => new Set());
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const { enviando, errorEnvio, enviar } = useEnvio();
  const columnas = columnasMedida(ocultos);
  const listaId = 'medidas-existentes';

  // Al guardar llegan las medidas nuevas con su id y su código
  const [base, setBase] = useState(inicial);
  if (base !== inicial) {
    setBase(inicial);
    setFilas(inicial.length ? inicial : [filaVacia()]);
    setTocadas(new Set());
    setIntentoGuardar(false);
  }

  const sinCambios = firma(filas) === firma(inicial);

  /** Errores de cada fila: { clave: { campo: mensaje } } */
  const errores = useMemo(() => {
    const porFila = {};
    const vistas = new Map();
    for (const f of filas) {
      // Una fila nueva sin nada escrito no se revisa (ni se envía)
      if (enBlanco(f)) continue;
      const e = {};
      const medida = normalizarMedida(f.medidas);
      if (!medida) e.medidas = 'Escribe la medida';
      for (const c of columnas) {
        const problema = c.validar?.(f[c.key]);
        if (problema) e[c.key] = problema;
      }
      // La misma medida, en la misma posición y con el mismo índice, es repetida
      const llave = `${medida}|${f.posicion}|${f.indiceCarga.trim()}`;
      if (medida && vistas.has(llave)) e.medidas = 'Repetida (misma posición e índice)';
      vistas.set(llave, true);
      if (Object.keys(e).length) porFila[f.clave] = e;
    }
    return porFila;
  }, [filas, columnas]);
  const hayErrores = Object.keys(errores).length > 0;

  const cambiar = (clave, campo, valor) => {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
    setTocadas((t) => new Set(t).add(`${clave}.${campo}`));
  };
  const agregar = () => setFilas((fs) => [...fs, filaVacia({ posicion: fs.at(-1)?.posicion ?? '' })]);
  const duplicar = (fila) =>
    setFilas((fs) => {
      const i = fs.findIndex((f) => f.clave === fila.clave);
      const { id: _id, codigo: _codigo, clave: _clave, ...datos } = fila;
      const copia = filaVacia({ ...datos, medidas: '', activo: true });
      return [...fs.slice(0, i + 1), copia, ...fs.slice(i + 1)];
    });
  const quitar = (fila) => setFilas((fs) => (fs.length > 1 ? fs.filter((f) => f.clave !== fila.clave) : [filaVacia()]));
  const descartar = () => {
    setFilas(inicial.length ? inicial : [filaVacia()]);
    setTocadas(new Set());
    setIntentoGuardar(false);
  };

  const guardar = () => {
    setIntentoGuardar(true);
    if (hayErrores) return;
    const aEnviar = filas.filter((f) => !enBlanco(f));
    enviar(() => onGuardar(aEnviar));
  };

  const errorDe = (fila, campo) =>
    (intentoGuardar || tocadas.has(`${fila.clave}.${campo}`)) && errores[fila.clave]?.[campo];

  const celda = (fila, c) => {
    const error = errorDe(fila, c.key);
    const clase = `${CELDA} ${error ? BORDER_ERR : BORDER_OK}`;
    const etiqueta = `${c.label} de la fila ${fila.medidas || 'nueva'}`;
    if (c.tipo === 'select') {
      return (
        <div className="relative">
          <select value={fila[c.key]} onChange={(e) => cambiar(fila.clave, c.key, e.target.value)} aria-label={etiqueta} className={`${clase} cursor-pointer appearance-none pr-7`}>
            <option value="">Sin dato</option>
            {c.opciones.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        </div>
      );
    }
    return (
      <input
        value={fila[c.key]}
        onChange={(e) => cambiar(fila.clave, c.key, c.numerico ? soloDigitos(e.target.value) : e.target.value)}
        onBlur={c.key === 'medidas' ? (e) => cambiar(fila.clave, 'medidas', normalizarMedida(e.target.value)) : undefined}
        placeholder={c.placeholder}
        maxLength={c.max ?? 30}
        list={c.key === 'medidas' ? listaId : undefined}
        inputMode={c.numerico ? 'numeric' : undefined}
        aria-label={etiqueta}
        aria-invalid={Boolean(error)}
        title={error || undefined}
        className={clase}
      />
    );
  };

  const nuevas = filas.filter((f) => !f.id && normalizarMedida(f.medidas)).length;

  return (
    <div>
      <datalist id={listaId}>
        {medidasExistentes.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            <tr>
              <th scope="col" className="w-28 px-3 py-2.5 font-semibold">
                Código
              </th>
              {columnas.map((c) => (
                <th key={c.key} scope="col" className={`px-1.5 py-2.5 font-semibold ${c.ancho}`}>
                  {c.label}
                  {c.requerido && <span className="ml-0.5 text-red-500">*</span>}
                </th>
              ))}
              <th scope="col" className="w-32 px-2 py-2.5 font-semibold">
                Estado
              </th>
              <th scope="col" className="w-20 px-2 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {filas.map((f) => {
              // El primer error visible de la fila se escribe bajo la medida
              const mensajes = columnas.map((c) => errorDe(f, c.key)).filter(Boolean);
              return (
                <tr key={f.clave} className={f.activo ? '' : 'opacity-60'}>
                  <td className="px-3 py-2 align-top">
                    {f.codigo ? (
                      <span className="block pt-2.5 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">{f.codigo}</span>
                    ) : (
                      <span className="mt-2 inline-block rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        Nueva
                      </span>
                    )}
                  </td>
                  {columnas.map((c) => (
                    <td key={c.key} className="px-1.5 py-2 align-top">
                      {celda(f, c)}
                      {c.key === 'medidas' && mensajes.length > 0 && (
                        <span className="mt-1 block max-w-[14rem] text-[11px] font-medium leading-snug text-red-500">{mensajes[0]}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2 align-top">
                    <div className="pt-1">
                      <StatusSwitch
                        value={f.activo ? 'Activo' : 'Inactivo'}
                        onChange={(v) => cambiar(f.clave, 'activo', v === 'Activo')}
                        label={`Estado de ${f.medidas || 'la medida nueva'}`}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-center gap-0.5 pt-1">
                      <button
                        type="button"
                        onClick={() => duplicar(f)}
                        title="Duplicar: copia los datos para otra medida"
                        aria-label={`Duplicar ${f.medidas || 'la fila'}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-400/10 hover:text-amber-600"
                      >
                        <Copy size={15} />
                      </button>
                      {!f.id && (
                        <button
                          type="button"
                          onClick={() => quitar(f)}
                          title="Quitar esta fila"
                          aria-label={`Quitar ${f.medidas || 'la fila nueva'}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={agregar}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-400/10 dark:text-amber-400"
      >
        <Plus size={15} aria-hidden="true" /> Agregar medida
      </button>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Usa <Copy size={11} className="inline" aria-hidden="true" /> para copiar una fila y cambiar solo la medida. Una medida guardada no se
        borra: se desactiva (puede estar en cotizaciones y ventas).
      </p>

      <AvisoError mensaje={errorEnvio} className="mt-3" />

      {!sinCambios && (
        <div className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:bg-brand-navy-900/95">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Cambios sin guardar en las medidas{nuevas ? ` · ${nuevas} ${nuevas === 1 ? 'nueva' : 'nuevas'}` : ''}
            {intentoGuardar && hayErrores && <span className="ml-1 font-semibold text-red-500">· revisa las celdas en rojo</span>}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={descartar} disabled={enviando} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
              Descartar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={enviando}
              className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
            >
              {enviando ? 'Guardando…' : 'Guardar medidas'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
