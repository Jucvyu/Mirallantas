import { useState } from 'react';
import { Minus, Plus, Send, ShoppingCart, Trash2 } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL } from '../../components/base/formStyles';
import Modal from '../../components/base/Modal';
import SearchSelect from '../../components/base/SearchSelect';
import { LLANTAS_POR_REENCAUCHE } from '../../constantes';
import { useEnvio } from '../../hooks/useEnvio';
import { LUGAR_CLIENTE, LUGAR_LOCAL } from '../../services/reencauche.service';
import { opcionesClientes } from '../../utils/opciones';
import DisenoBanda from './DisenoBanda';
import { llantasTexto } from './reencauche';

const BOTON_SECUNDARIO =
  'rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700';

/** Una línea vacía para agregar otra banda. */
const lineaVacia = () => ({ clave: crypto.randomUUID(), bandaId: '', medida: '', cantidad: 1 });

/** Lo que le falta a una línea, o '' si está completa. */
function errorDeLinea(linea, banda) {
  if (!banda) return 'Elige la banda';
  if (!banda.medidas.includes(linea.medida)) return 'Elige la medida de tus llantas';
  if (!(Number(linea.cantidad) >= 1)) return 'Al menos una llanta';
  return '';
}

/** Botones − y + para la cantidad de llantas de una línea. */
function Cantidad({ valor, maximo, onCambio }) {
  const boton =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5';
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Cantidad de llantas">
      <button type="button" className={boton} disabled={valor <= 1} onClick={() => onCambio(valor - 1)} aria-label="Una llanta menos">
        <Minus size={14} />
      </button>
      <span className="min-w-[2.25rem] text-center text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{valor}</span>
      <button type="button" className={boton} disabled={valor >= maximo} onClick={() => onCambio(valor + 1)} aria-label="Una llanta más">
        <Plus size={14} />
      </button>
    </div>
  );
}

/**
 * Solicitud de reencauche con varias bandas, como un carro: cada línea es
 * una banda con la medida de esas llantas y cuántas. Debajo, dónde y cuándo
 * se revisan (la revisión es gratis).
 *
 *   bandas           bandas activas para elegir
 *   itemsIniciales   [{ bandaId, medida, cantidad }] (p. ej. el carro del portal)
 *   clientes         solo en el panel: el asesor elige el cliente
 *   direccion        dirección sugerida del cliente
 *   fechaMinima      AAAA-MM-DD (portal: desde mañana; panel: desde hoy)
 *   onItems          avisa cada cambio de las líneas (el portal guarda su carro)
 *   onAgregarMas     portal: cierra y vuelve al catálogo para elegir otra banda
 *   onEnviar(valores) → { clienteId?, items, lugar, direccion, fechaPreferida, notas }
 */
export default function SolicitudReencaucheModal({
  titulo,
  subtitulo,
  bandas,
  itemsIniciales = [],
  clientes,
  direccion: direccionSugerida = '',
  fechaMinima,
  etiquetaDondeCliente = LUGAR_CLIENTE,
  onItems,
  onAgregarMas,
  onEnviar,
  onClose,
}) {
  const activas = bandas.filter((b) => b.activo !== false);
  const bandaDe = (id) => activas.find((b) => b.id === Number(id));
  const [items, setItems] = useState(() =>
    itemsIniciales.length ? itemsIniciales.map((i) => ({ clave: crypto.randomUUID(), ...i })) : [lineaVacia()],
  );
  const [clienteId, setClienteId] = useState('');
  const [lugar, setLugar] = useState(LUGAR_LOCAL);
  const [direccion, setDireccion] = useState(direccionSugerida ?? '');
  const [fecha, setFecha] = useState(fechaMinima);
  const [notas, setNotas] = useState('');
  const [intentado, setIntentado] = useState(false);
  const { enviando, errorEnvio, setErrorEnvio, enviar } = useEnvio();

  const total = items.reduce((suma, i) => suma + (Number(i.cantidad) || 0), 0);
  const libres = LLANTAS_POR_REENCAUCHE - total;

  const cambiarItems = (nuevos) => {
    setItems(nuevos);
    onItems?.(nuevos.filter((i) => i.bandaId).map(({ bandaId, medida, cantidad }) => ({ bandaId, medida, cantidad })));
  };
  const cambiar = (clave, cambio) =>
    cambiarItems(
      items.map((i) => {
        if (i.clave !== clave) return i;
        const nueva = { ...i, ...cambio };
        // Otra banda: si la medida ya no le sirve, se propone la primera que sí
        if (cambio.bandaId !== undefined) {
          const banda = bandaDe(cambio.bandaId);
          if (banda && !banda.medidas.includes(nueva.medida)) nueva.medida = banda.medidas[0] ?? '';
        }
        return nueva;
      }),
    );
  const quitar = (clave) => cambiarItems(items.length > 1 ? items.filter((i) => i.clave !== clave) : [lineaVacia()]);

  const enLocal = lugar === LUGAR_LOCAL;
  const errores = {
    cliente: clientes && !clienteId ? 'Elige el cliente' : '',
    lineas: items.map((i) => errorDeLinea(i, bandaDe(i.bandaId))),
    total: total > LLANTAS_POR_REENCAUCHE ? `Máximo ${LLANTAS_POR_REENCAUCHE} llantas por solicitud` : '',
    fecha: !fecha || fecha < fechaMinima ? 'Elige una fecha válida' : '',
    direccion: !enLocal && !direccion.trim() ? 'Escribe la dirección donde revisamos las llantas' : '',
  };
  const hayErrores = Boolean(errores.cliente || errores.total || errores.fecha || errores.direccion || errores.lineas.some(Boolean));

  const enviarSolicitud = (close) => {
    setIntentado(true);
    if (hayErrores) {
      setErrorEnvio('Revisa lo marcado en rojo.');
      return;
    }
    enviar(
      () =>
        onEnviar({
          ...(clientes ? { clienteId } : {}),
          items: items.map(({ bandaId, medida, cantidad }) => ({ bandaId, medida, cantidad })),
          lugar,
          direccion,
          fechaPreferida: fecha,
          notas,
        }),
      close,
    );
  };

  const opcionesBanda = activas.map((b) => ({
    valor: b.id,
    etiqueta: b.nombre,
    detalle: `${b.diseno} · ${b.anchoMm} mm · ${b.tipoVehiculo ?? ''}`,
  }));
  const err = (texto) => intentado && texto && <span className="mt-1 block text-xs font-medium text-red-500">{texto}</span>;

  return (
    <Modal
      title={titulo}
      subtitle={subtitulo}
      icon={<ShoppingCart size={17} />}
      size="xl"
      onClose={onClose}
      footer={(close) => (
        <>
          <button type="button" onClick={close} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => enviarSolicitud(close)}
            className="ml-pulsable inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            <Send size={15} /> {enviando ? 'Enviando…' : `Enviar solicitud · ${llantasTexto(total)}`}
          </button>
        </>
      )}
    >
      <div className="space-y-6">
        {clientes && (
          <section>
            <span className={LABEL}>
              Cliente <span className="text-red-500">*</span>
            </span>
            <SearchSelect
              value={clienteId}
              options={opcionesClientes(clientes)}
              onChange={setClienteId}
              placeholder="Elegir cliente"
              placeholderBusqueda="Nombre o número de documento"
              error={intentado && Boolean(errores.cliente)}
            />
            {err(errores.cliente)}
          </section>
        )}

        {/* ---- Las llantas: una línea por banda ---- */}
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tus llantas</h3>
            <p className={`text-xs tabular-nums ${libres < 0 ? 'font-semibold text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
              {llantasTexto(total)} · máximo {LLANTAS_POR_REENCAUCHE} por solicitud
            </p>
          </div>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
            {items.map((item, i) => {
              const banda = bandaDe(item.bandaId);
              const error = intentado ? errores.lineas[i] : '';
              return (
                <li key={item.clave} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto] sm:items-end">
                  <label className="block min-w-0">
                    <span className={LABEL}>Banda {items.length > 1 ? i + 1 : ''}</span>
                    <SearchSelect
                      value={item.bandaId}
                      options={opcionesBanda}
                      onChange={(v) => cambiar(item.clave, { bandaId: v })}
                      placeholder="Elegir banda"
                      placeholderBusqueda="Nombre o diseño"
                      error={Boolean(error) && !banda}
                    />
                    {banda && (
                      <span className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <DisenoBanda diseno={banda.diseno} /> {banda.anchoMm} mm
                      </span>
                    )}
                  </label>
                  <label className="block min-w-0">
                    <span className={LABEL}>Medida</span>
                    <select
                      value={item.medida}
                      disabled={!banda}
                      onChange={(e) => cambiar(item.clave, { medida: e.target.value })}
                      className={`${INPUT} ${error && banda ? BORDER_ERR : BORDER_OK} cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {!banda && <option value="">Primero la banda</option>}
                      {banda?.medidas.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className={LABEL}>Cantidad</span>
                    <Cantidad
                      valor={Number(item.cantidad) || 1}
                      maximo={(Number(item.cantidad) || 1) + Math.max(0, libres)}
                      onCambio={(n) => cambiar(item.clave, { cantidad: n })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => quitar(item.clave)}
                    aria-label="Quitar esta banda"
                    className="flex h-9 w-9 items-center justify-center justify-self-end rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                  {error && <p className="text-xs font-medium text-red-500 sm:col-span-4">{error}</p>}
                </li>
              );
            })}
          </ul>
          {err(errores.total)}
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={libres <= 0 || items.length >= 10}
              onClick={() => cambiarItems([...items, lineaVacia()])}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800 disabled:opacity-50 dark:text-amber-400"
            >
              <Plus size={15} /> Agregar otra banda
            </button>
            {onAgregarMas && (
              <button
                type="button"
                onClick={onAgregarMas}
                className="text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Ver el catálogo de bandas
              </button>
            )}
          </div>
        </section>

        {/* ---- Revisión: dónde y cuándo ---- */}
        <section className="grid gap-4 border-t border-slate-200 pt-5 dark:border-white/10 sm:grid-cols-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white sm:col-span-2">Aprobación de revisión (gratis)</h3>
          <div>
            <span className={LABEL}>Dónde revisamos las llantas</span>
            <div role="radiogroup" aria-label="Dónde revisamos las llantas" className="grid grid-cols-2 gap-2">
              {[LUGAR_LOCAL, etiquetaDondeCliente].map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  role="radio"
                  aria-checked={lugar === opcion}
                  onClick={() => setLugar(opcion)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    lugar === opcion
                      ? 'border-amber-400 bg-amber-400/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300'
                  }`}
                >
                  {opcion}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={LABEL}>
              Fecha que prefieres <span className="text-red-500">*</span>
            </span>
            <input
              type="date"
              value={fecha}
              min={fechaMinima}
              onChange={(e) => setFecha(e.target.value)}
              className={`${INPUT} ${intentado && errores.fecha ? BORDER_ERR : BORDER_OK}`}
            />
            <span className="mt-1 block text-xs text-slate-400">Si no podemos ese día, te proponemos otro y tú lo confirmas.</span>
            {err(errores.fecha)}
          </label>
          {!enLocal && (
            <label className="block sm:col-span-2">
              <span className={LABEL}>
                Dirección <span className="text-red-500">*</span>
              </span>
              <input
                value={direccion}
                maxLength={200}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Dónde revisamos las llantas"
                className={`${INPUT} ${intentado && errores.direccion ? BORDER_ERR : BORDER_OK}`}
              />
              {err(errores.direccion)}
            </label>
          )}
          <label className="block sm:col-span-2">
            <span className={LABEL}>Algo que debamos saber (opcional)</span>
            <textarea
              rows={2}
              maxLength={500}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej.: son las de tracción del camión y ya tienen un reencauche."
              className={`${INPUT} ${BORDER_OK} resize-none`}
            />
          </label>
        </section>

        <AvisoError mensaje={errorEnvio} />
      </div>
    </Modal>
  );
}
