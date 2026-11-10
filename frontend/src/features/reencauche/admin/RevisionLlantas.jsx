import { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL, formatoMiles, soloDigitos } from '../../../components/base/formStyles';
import { LLANTAS_POR_REENCAUCHE } from '../../../constantes';
import { useEnvio } from '../../../hooks/useEnvio';
import { formatCOP, parseCOP } from '../../../utils/formato';

const miles = (n) => (n ? Number(n).toLocaleString('es-CO') : '');

/** Llantas del formulario: las ya revisadas, o tantas vacías como pidió el cliente. */
function filasIniciales(solicitud, bandas) {
  if (solicitud.llantas.length) {
    return solicitud.llantas.map((l) => ({
      identificador: l.identificador,
      medida: l.medida,
      reencauchesPrevios: String(l.reencauchesPrevios ?? 0),
      resultado: l.resultado,
      motivoNoApta: l.motivoNoApta ?? '',
      bandaId: l.bandaId ?? '',
      precioBanda: miles(l.precioBanda),
      manoObra: miles(l.manoObra),
    }));
  }
  const pedida = bandas.find((b) => b.id === solicitud.bandaId);
  return Array.from({ length: solicitud.cantidad }, () => ({
    identificador: '',
    medida: solicitud.medida,
    reencauchesPrevios: '0',
    resultado: 'Apta',
    motivoNoApta: '',
    bandaId: pedida?.activo ? pedida.id : '',
    precioBanda: pedida?.activo ? miles(pedida.precioValor) : '',
    manoObra: '',
  }));
}

/** ID de la llanta: letras, números y guiones, en mayúsculas (máximo 20). */
const limpiarId = (texto) => texto.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);

/**
 * Lo que le falta a cada llanta (por campo), o {} si está completa.
 * `repetido` dice si su ID ya lo tiene otra llanta de la solicitud.
 */
function erroresDe(f, repetido) {
  const e = {};
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(f.identificador)) e.identificador = 'Escribe el ID de la llanta';
  else if (repetido) e.identificador = 'Otra llanta ya tiene este ID';
  if (f.resultado === 'No apta' && !f.motivoNoApta.trim()) e.motivoNoApta = 'Escribe por qué no sirve';
  if (f.resultado === 'Apta') {
    if (!f.bandaId) e.bandaId = 'Elige la banda';
    if (!parseCOP(f.precioBanda)) e.precioBanda = 'Escribe el precio';
    if (!parseCOP(f.manoObra)) e.manoObra = 'Escribe la mano de obra';
  }
  return e;
}

const valorDe = (f) => (f.resultado === 'Apta' ? parseCOP(f.precioBanda) + parseCOP(f.manoObra) : 0);

function Campo({ etiqueta, error, className = '', children }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={LABEL}>{etiqueta}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

function Selector({ error, children, ...props }) {
  return (
    <div className="relative">
      <select {...props} className={`${INPUT} ${error ? BORDER_ERR : BORDER_OK} cursor-pointer appearance-none pr-9`}>
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/**
 * Formulario de la revisión: lo que el asesor encontró en cada llanta con
 * el cliente. Una llanta apta lleva una banda compatible con su medida y su
 * valor (banda + mano de obra); una no apta, el motivo. Con esto queda la
 * cotización que el cliente acepta sin pagar.
 *
 * Cada llanta es un bloque con sus campos en rejilla: nada se desborda de
 * lado, ni en celular.
 */
export default function RevisionLlantas({ solicitud, bandas, onEmitir, onCancelar }) {
  const activas = bandas.filter((b) => b.activo);
  const [filas, setFilas] = useState(() => filasIniciales(solicitud, bandas));
  const [intentado, setIntentado] = useState(false);
  const { enviando, errorEnvio, setErrorEnvio, enviar } = useEnvio();

  const compatibles = (medida) => activas.filter((b) => b.medidas.includes(medida));
  // Medidas que se pueden elegir: las de las bandas activas y las ya escritas
  const medidas = [...new Set([...activas.flatMap((b) => b.medidas), ...filas.map((f) => f.medida)])].sort();

  const cambiar = (i, cambio) =>
    setFilas((actuales) =>
      actuales.map((f, j) => {
        if (j !== i) return f;
        const nueva = { ...f, ...cambio };
        // Otra medida: si la banda ya no sirve, se propone la primera que sí
        if (cambio.medida && !compatibles(cambio.medida).some((b) => b.id === Number(nueva.bandaId))) {
          const primera = compatibles(cambio.medida)[0];
          nueva.bandaId = primera?.id ?? '';
          nueva.precioBanda = miles(primera?.precioValor);
        }
        // Otra banda: se propone su precio de catálogo
        if (cambio.bandaId !== undefined) {
          nueva.precioBanda = miles(activas.find((b) => b.id === Number(cambio.bandaId))?.precioValor);
        }
        return nueva;
      }),
    );

  // Una llanta nueva copia la medida, la banda y los valores de la anterior
  const agregar = () =>
    setFilas((actuales) => [...actuales, { ...actuales[actuales.length - 1], identificador: '', reencauchesPrevios: '0' }]);
  const quitar = (i) => setFilas((actuales) => actuales.filter((_, j) => j !== i));

  const errores = filas.map((f, i) => erroresDe(f, filas.some((otra, j) => j < i && otra.identificador && otra.identificador === f.identificador)));
  const aptas = filas.filter((f) => f.resultado === 'Apta').length;
  const total = filas.reduce((suma, f) => suma + valorDe(f), 0);

  const emitir = () => {
    setIntentado(true);
    if (errores.some((e) => Object.keys(e).length)) {
      setErrorEnvio('Revisa las llantas marcadas en rojo.');
      return;
    }
    enviar(() => onEmitir(filas));
  };

  return (
    <div>
      <ol>
        {filas.map((f, i) => {
          const n = i + 1;
          const apta = f.resultado === 'Apta';
          const err = intentado ? errores[i] : {};
          const opciones = compatibles(f.medida);
          return (
            <li key={i} className="border-t border-slate-100 py-5 first:border-t-0 first:pt-0 dark:border-white/5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Llanta {n}</h3>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold tabular-nums ${apta ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                    {apta ? formatCOP(valorDe(f)) : 'No se cobra'}
                  </span>
                  {filas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitar(i)}
                      aria-label={`Quitar la llanta ${n}`}
                      title="Quitar la llanta"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Campo etiqueta="ID de la llanta" error={err.identificador}>
                  <input
                    value={f.identificador}
                    maxLength={20}
                    placeholder="LL-0145"
                    autoCapitalize="characters"
                    onChange={(e) => cambiar(i, { identificador: limpiarId(e.target.value) })}
                    className={`${INPUT} ${err.identificador ? BORDER_ERR : BORDER_OK} tabular-nums uppercase`}
                  />
                </Campo>
                <Campo etiqueta="Medida">
                  <Selector value={f.medida} onChange={(e) => cambiar(i, { medida: e.target.value })}>
                    {medidas.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <Campo etiqueta="Reencauches previos">
                  <input
                    value={f.reencauchesPrevios}
                    inputMode="numeric"
                    maxLength={1}
                    onChange={(e) => cambiar(i, { reencauchesPrevios: soloDigitos(e.target.value).slice(0, 1) })}
                    className={`${INPUT} ${BORDER_OK} tabular-nums`}
                  />
                </Campo>
                <div className="min-w-0">
                  <span className={LABEL}>Resultado</span>
                  <div
                    role="radiogroup"
                    aria-label={`Resultado de la llanta ${n}`}
                    className="grid grid-cols-2 gap-1 rounded-[14px] border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-brand-navy-900/70"
                  >
                    {['Apta', 'No apta'].map((opcion) => {
                      const marcada = f.resultado === opcion;
                      return (
                        <button
                          key={opcion}
                          type="button"
                          role="radio"
                          aria-checked={marcada}
                          onClick={() => cambiar(i, { resultado: opcion })}
                          className={`rounded-[10px] py-1.5 text-sm font-semibold transition-colors ${
                            marcada
                              ? opcion === 'Apta'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-red-500 text-white'
                              : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                          }`}
                        >
                          {opcion}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {apta ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <Campo etiqueta="Banda" error={err.bandaId} className="sm:col-span-2">
                    {opciones.length ? (
                      <Selector value={f.bandaId} error={err.bandaId} onChange={(e) => cambiar(i, { bandaId: e.target.value })}>
                        <option value="">Elegir banda…</option>
                        {opciones.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nombre} · {b.diseno} · {b.anchoMm} mm
                          </option>
                        ))}
                      </Selector>
                    ) : (
                      <p className="rounded-[14px] border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        No hay una banda activa para {f.medida}. Regístrala en Bandas o marca la llanta como no apta.
                      </p>
                    )}
                  </Campo>
                  <Campo etiqueta="Precio de la banda" error={err.precioBanda}>
                    <Dinero valor={f.precioBanda} error={err.precioBanda} onCambio={(v) => cambiar(i, { precioBanda: v })} />
                  </Campo>
                  <Campo etiqueta="Mano de obra" error={err.manoObra}>
                    <Dinero valor={f.manoObra} error={err.manoObra} onCambio={(v) => cambiar(i, { manoObra: v })} />
                  </Campo>
                </div>
              ) : (
                <Campo etiqueta="Por qué no sirve" error={err.motivoNoApta} className="mt-3">
                  <input
                    value={f.motivoNoApta}
                    maxLength={300}
                    placeholder="Ej.: corte en el costado, carcasa de más de 7 años, separación de capas"
                    onChange={(e) => cambiar(i, { motivoNoApta: e.target.value })}
                    className={`${INPUT} ${err.motivoNoApta ? BORDER_ERR : BORDER_OK}`}
                  />
                </Campo>
              )}
            </li>
          );
        })}
      </ol>

      <AvisoError mensaje={errorEnvio} className="mt-2" />

      <div className="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={agregar}
          disabled={filas.length >= LLANTAS_POR_REENCAUCHE}
          className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm font-semibold text-amber-600 hover:bg-amber-400/10 disabled:opacity-40 dark:text-amber-400"
        >
          <Plus size={15} /> Agregar llanta
        </button>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="mr-1 text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {aptas} {aptas === 1 ? 'apta' : 'aptas'} · {filas.length - aptas} {filas.length - aptas === 1 ? 'no apta' : 'no aptas'} · se cobra al entregar
            </p>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{formatCOP(total)}</p>
          </div>
          {onCancelar && (
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={emitir}
            disabled={enviando}
            className="ml-pulsable rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : aptas ? 'Emitir cotización' : 'Cerrar: ninguna sirve'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Campo de pesos: solo dígitos, con separador de miles. */
function Dinero({ valor, error, onCambio }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <input
        value={valor}
        inputMode="numeric"
        placeholder="0"
        onChange={(e) => onCambio(formatoMiles(e.target.value))}
        className={`${INPUT} ${error ? BORDER_ERR : BORDER_OK} pl-7 tabular-nums`}
      />
    </div>
  );
}
