import { useEffect, useMemo, useState } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Dropdown from '../../../components/base/Dropdown';
import EmptyState from '../../../components/base/EmptyState';
import Modal from '../../../components/base/Modal';
import Skeleton from '../../../components/base/Skeleton';
import { disenosBanda, LLANTAS_POR_REENCAUCHE } from '../../../constantes';
import { useAuth } from '../../../context/AuthContext';
import { useRecurso } from '../../../hooks/useRecurso';
import { portalReencaucheService } from '../../../services';
import DisenoBanda from '../DisenoBanda';
import PisadaBanda from '../PisadaBanda';
import { llantasTexto } from '../reencauche';
import SolicitudReencaucheModal from '../SolicitudReencaucheModal';
import TarjetaReencauche from './TarjetaReencauche';

/** Servicio de las bandas del portal, con la forma que espera useRecurso (fijo). */
const bandasDelPortal = { listar: () => portalReencaucheService.bandas() };

const LUGAR_MI_DIRECCION = 'En mi dirección';

/** Mañana, en AAAA-MM-DD: la fecha sugerida para la revisión. */
function manana() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Carro de reencauche de cada usuario, guardado en este navegador. */
const claveCarro = (usuarioId) => `mirallantas.carro-reencauche.${usuarioId}`;
function leerCarro(usuarioId) {
  try {
    const lista = JSON.parse(localStorage.getItem(claveCarro(usuarioId)) ?? '[]');
    return Array.isArray(lista) ? lista.filter((i) => i && i.bandaId && i.medida && i.cantidad > 0) : [];
  } catch {
    return [];
  }
}

/** Suma una línea al carro: la misma banda con la misma medida se junta. */
function sumarAlCarro(carro, linea) {
  const igual = carro.find((i) => i.bandaId === linea.bandaId && i.medida === linea.medida);
  if (!igual) return [...carro, linea];
  return carro.map((i) => (i === igual ? { ...i, cantidad: i.cantidad + linea.cantidad } : i));
}

/** Elige la medida y cuántas llantas de esta banda, y la agrega al carro. */
function AgregarModal({ banda, medidaSugerida, libres, onAgregar, onClose }) {
  const [medida, setMedida] = useState(banda.medidas.includes(medidaSugerida) ? medidaSugerida : banda.medidas[0]);
  const [cantidad, setCantidad] = useState(1);
  const maximo = Math.max(1, libres);
  return (
    <Modal
      title="Agregar a tu solicitud"
      subtitle={banda.nombre}
      icon={<ShoppingCart size={17} />}
      size="sm"
      onClose={onClose}
      footer={(close) => (
        <>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={libres <= 0}
            onClick={() => {
              onAgregar({ bandaId: banda.id, medida, cantidad });
              close();
            }}
            className="ml-pulsable inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
          >
            <Plus size={15} /> Agregar {llantasTexto(cantidad)}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-200">Medida de tus llantas</span>
          <select
            value={medida}
            onChange={(e) => setMedida(e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 dark:border-white/10 dark:bg-brand-navy-900 dark:text-slate-100"
          >
            {banda.medidas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-200">Cuántas llantas</span>
          <div className="flex items-center gap-2">
            {[-1, 1].map((paso) => (
              <button
                key={paso}
                type="button"
                disabled={paso < 0 ? cantidad <= 1 : cantidad >= maximo}
                onClick={() => setCantidad((n) => n + paso)}
                aria-label={paso < 0 ? 'Una llanta menos' : 'Una llanta más'}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg font-bold text-slate-600 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 ${paso < 0 ? 'order-first' : 'order-last'}`}
              >
                {paso < 0 ? '−' : '+'}
              </button>
            ))}
            <span className="min-w-[3rem] text-center text-lg font-bold tabular-nums text-slate-900 dark:text-white">{cantidad}</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {libres <= 0 ? `Tu solicitud ya tiene el máximo de ${LLANTAS_POR_REENCAUCHE} llantas.` : `Puedes agregar hasta ${libres} más.`}
          </p>
        </div>
      </div>
    </Modal>
  );
}

/** Ficha de una banda en el catálogo del portal (sin precio: se cotiza al revisar). */
function BandaCard({ banda, onPedir }) {
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-brand-navy-800">
      <PisadaBanda diseno={banda.diseno} />
      <div className="mt-3 flex items-start justify-between gap-2">
        <h2 className="text-sm font-bold leading-snug text-slate-900 dark:text-white">{banda.nombre}</h2>
        <DisenoBanda diseno={banda.diseno} />
      </div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{banda.tipoVehiculo}</p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-400 dark:text-slate-500">Ancho de banda</dt>
          <dd className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{banda.anchoMm} mm</dd>
        </div>
        <div>
          <dt className="text-slate-400 dark:text-slate-500">Profundidad</dt>
          <dd className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{banda.profundidadMm} mm</dd>
        </div>
      </dl>

      <div className="mt-3 flex-1">
        <p className="text-xs text-slate-400 dark:text-slate-500">Medidas para llantas</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {banda.medidas.map((m) => (
            <span
              key={m}
              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-white/5 dark:text-slate-300"
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onPedir(banda)}
        className="ml-pulsable mt-4 w-full rounded-lg bg-amber-400 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300"
      >
        Agregar a la solicitud
      </button>
    </article>
  );
}

/**
 * Reencauche en el portal del cliente.
 *
 *   Elegir banda      catálogo de bandas por diseño, vehículo y medida. La
 *                     banda no se compra sola: se pide con el servicio.
 *   Mis reencauches   cada solicitud con su avance y sus llantas. Se acepta
 *                     la cotización sin pagar; cada llanta se paga al recibirla.
 */
export default function ReencauchePortalPage() {
  const { usuario } = useAuth();
  const bandas = useRecurso(bandasDelPortal);
  const mis = useRecurso(portalReencaucheService);
  const [vista, setVista] = useState(null);
  const [diseno, setDiseno] = useState('');
  const [vehiculo, setVehiculo] = useState('');
  const [medida, setMedida] = useState('');
  // Banda que se está agregando al carro, y si la solicitud (el carro) está abierta
  const [agregando, setAgregando] = useState(null);
  const [viendoCarro, setViendoCarro] = useState(false);
  const usuarioId = usuario?.id ?? null;
  const [carro, setCarro] = useState(() => leerCarro(usuarioId));
  useEffect(() => {
    try {
      if (carro.length) localStorage.setItem(claveCarro(usuarioId), JSON.stringify(carro));
      else localStorage.removeItem(claveCarro(usuarioId));
    } catch {
      // Sin almacenamiento: el carro dura lo que dure la pestaña
    }
  }, [carro, usuarioId]);
  const llantasEnCarro = carro.reduce((suma, i) => suma + i.cantidad, 0);

  // Si ya tiene solicitudes, abre en "Mis reencauches"; si no, en el catálogo
  const vistaActual = vista ?? (mis.filas.length ? 'mis' : 'bandas');
  // Primero lo que espera una respuesta del cliente, después lo que sigue en curso
  const prioridad = (s) =>
    ['Cotizada', 'Por confirmar'].includes(s.estado) ? 0 : ['Por agendar', 'Agendada'].includes(s.estado) || (s.estado === 'Aceptada' && s.enProceso > 0) ? 1 : 2;
  const solicitudes = [...mis.filas].sort((a, b) => prioridad(a) - prioridad(b) || b.numero.localeCompare(a.numero));
  const abiertas = mis.filas.filter((s) => ['Por agendar', 'Por confirmar', 'Agendada', 'Cotizada'].includes(s.estado) || (s.estado === 'Aceptada' && s.enProceso > 0)).length;

  const vehiculos = useMemo(() => [...new Set(bandas.filas.map((b) => b.tipoVehiculo))].sort(), [bandas.filas]);
  const medidas = useMemo(() => [...new Set(bandas.filas.flatMap((b) => b.medidas))].sort(), [bandas.filas]);
  const visibles = bandas.filas.filter(
    (b) => (!diseno || b.diseno === diseno) && (!vehiculo || b.tipoVehiculo === vehiculo) && (!medida || b.medidas.includes(medida)),
  );
  const descripcion = disenosBanda.find((d) => d.nombre === diseno)?.descripcion;

  const pestana = (clave, texto) => (
    <button
      type="button"
      role="tab"
      aria-selected={vistaActual === clave}
      onClick={() => setVista(clave)}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        vistaActual === clave
          ? 'bg-amber-400 text-slate-900'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Reencauche</h1>
          <p className="mt-1 max-w-prose text-sm text-slate-500 dark:text-slate-400">
            Elige la banda para tus llantas. Las revisamos gratis contigo y pagas cada una solo cuando la recibes reencauchada.
          </p>
        </div>
        <div role="tablist" aria-label="Reencauche" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-brand-navy-800">
          {pestana('bandas', 'Elegir banda')}
          {pestana('mis', abiertas ? `Mis reencauches (${abiertas})` : 'Mis reencauches')}
        </div>
      </header>

      {vistaActual === 'bandas' ? (
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Diseño" className="flex flex-wrap gap-1.5">
              {['', ...disenosBanda.map((d) => d.nombre)].map((d) => (
                <button
                  key={d || 'todos'}
                  type="button"
                  aria-pressed={diseno === d}
                  onClick={() => setDiseno(d)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    diseno === d
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-300'
                  }`}
                >
                  {d || 'Todos los diseños'}
                </button>
              ))}
            </div>
            <Dropdown label="Vehículo" value={vehiculo} options={vehiculos} onChange={setVehiculo} allLabel="Todos" />
            <Dropdown label="Medida" value={medida} options={medidas} onChange={setMedida} allLabel="Todas" />
          </div>
          <p className="mt-3 min-h-[1.25rem] text-sm text-slate-500 dark:text-slate-400">
            {descripcion
              ? <><b className="font-semibold text-slate-700 dark:text-slate-200">{diseno}:</b> {descripcion}</>
              : '¿No sabes cuál? Direccional va en el eje delantero; tracción, en los ejes con fuerza del motor; mixta, en vías destapadas.'}
          </p>

          <AvisoError mensaje={bandas.error} className="mt-4" />

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bandas.cargando &&
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
            {visibles.map((b) => (
              <BandaCard key={b.id} banda={b} onPedir={setAgregando} />
            ))}
          </div>
          {!bandas.cargando && visibles.length === 0 && (
            <EmptyState
              icon="Disc3"
              title="No hay bandas con esos filtros"
              description="Cambia el diseño o la medida. Si no encuentras la tuya, escríbenos y la conseguimos."
            />
          )}
        </section>
      ) : (
        <section className="max-w-4xl space-y-4">
          <AvisoError mensaje={mis.error} />
          {mis.cargando && <Skeleton className="h-48 w-full rounded-xl" />}
          {solicitudes.map((s) => (
            <TarjetaReencauche
              key={s.numero}
              solicitud={s}
              onResponder={(acepta) => mis.ejecutar(() => portalReencaucheService.responder(s.numero, acepta))}
              onConfirmarFecha={() => mis.ejecutar(() => portalReencaucheService.confirmarFecha(s.numero))}
              onCancelar={(motivo) => mis.ejecutar(() => portalReencaucheService.cancelar(s.numero, motivo))}
            />
          ))}
          {!mis.cargando && mis.filas.length === 0 && (
            <EmptyState
              icon="Disc3"
              title="Aún no has pedido reencauches"
              description="Elige una banda en el catálogo y agenda la revisión gratis de tus llantas."
            />
          )}
        </section>
      )}

      {/* Carro de reencauche: se ve mientras tenga llantas */}
      {carro.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setViendoCarro(true)}
            className="ml-pulsable ml-aparece inline-flex items-center gap-3 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-xl shadow-slate-900/30 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <ShoppingCart size={17} />
            Tu solicitud: {llantasTexto(llantasEnCarro)} · {carro.length} {carro.length === 1 ? 'banda' : 'bandas'}
            <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-slate-900">Revisar y enviar</span>
          </button>
        </div>
      )}

      {agregando && (
        <AgregarModal
          banda={agregando}
          medidaSugerida={medida}
          libres={LLANTAS_POR_REENCAUCHE - llantasEnCarro}
          onAgregar={(linea) => setCarro((actual) => sumarAlCarro(actual, linea))}
          onClose={() => setAgregando(null)}
        />
      )}

      {viendoCarro && (
        <SolicitudReencaucheModal
          titulo="Tu solicitud de reencauche"
          subtitulo="Revisamos tus llantas gratis y te damos el valor. No pagas nada hasta recibirlas reencauchadas."
          bandas={bandas.filas}
          itemsIniciales={carro}
          direccion={usuario?.direccion}
          fechaMinima={manana()}
          etiquetaDondeCliente={LUGAR_MI_DIRECCION}
          onItems={setCarro}
          onAgregarMas={() => {
            setViendoCarro(false);
            setVista('bandas');
          }}
          onEnviar={async (valores) => {
            await portalReencaucheService.solicitar(valores);
            setCarro([]);
            await mis.recargar();
            setVista('mis');
          }}
          onClose={() => setViendoCarro(false)}
        />
      )}
    </div>
  );
}
