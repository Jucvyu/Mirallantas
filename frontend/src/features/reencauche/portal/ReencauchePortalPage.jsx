import { useMemo, useState } from 'react';
import AvisoError from '../../../components/base/AvisoError';
import Dropdown from '../../../components/base/Dropdown';
import EmptyState from '../../../components/base/EmptyState';
import FormModal from '../../../components/base/FormModal';
import Skeleton from '../../../components/base/Skeleton';
import { disenosBanda, LLANTAS_POR_REENCAUCHE } from '../../../constantes';
import { useAuth } from '../../../context/AuthContext';
import { useRecurso } from '../../../hooks/useRecurso';
import { portalReencaucheService } from '../../../services';
import { LUGAR_LOCAL } from '../../../services/reencauche.service';
import DisenoBanda from '../DisenoBanda';
import PisadaBanda from '../PisadaBanda';
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

/** Formulario para pedir el reencauche con la banda elegida. */
function PedirModal({ banda, medidaSugerida, direccion, onPedir, onClose }) {
  const sections = [
    {
      title: 'Tus llantas',
      fields: [
        { key: 'medida', label: 'Medida de tus llantas', type: 'select', required: true, options: banda.medidas },
        {
          key: 'cantidad',
          label: 'Cuántas llantas',
          type: 'number',
          required: true,
          validar: (v) => (Number(v) < 1 || Number(v) > LLANTAS_POR_REENCAUCHE ? `Entre 1 y ${LLANTAS_POR_REENCAUCHE} llantas` : ''),
        },
      ],
    },
    {
      title: 'Revisión gratis',
      fields: [
        { key: 'lugar', label: 'Dónde las revisamos', type: 'select', required: true, options: [LUGAR_LOCAL, LUGAR_MI_DIRECCION] },
        { key: 'fechaPreferida', label: 'Fecha que prefieres', type: 'date', futura: true, required: true },
        {
          key: 'direccion',
          label: 'Tu dirección',
          span: 2,
          placeholder: 'Solo si la revisión es en tu dirección',
          validar: (v, valores) =>
            valores.lugar === LUGAR_MI_DIRECCION && !String(v ?? '').trim() ? 'Escribe dónde revisamos las llantas' : '',
        },
        {
          key: 'notas',
          label: 'Algo que debamos saber (opcional)',
          type: 'textarea',
          span: 2,
          placeholder: 'Ej.: son las de tracción del camión y ya tienen un reencauche.',
        },
      ],
    },
  ];

  return (
    <FormModal
      mode="create"
      title={`Pedir reencauche · ${banda.nombre}`}
      subtitle="Revisamos tus llantas gratis y te damos el valor. No pagas nada hasta recibirlas reencauchadas."
      sections={sections}
      initialValues={{
        medida: banda.medidas.includes(medidaSugerida) ? medidaSugerida : banda.medidas[0],
        cantidad: '1',
        lugar: LUGAR_LOCAL,
        fechaPreferida: manana(),
        direccion: direccion ?? '',
      }}
      submitLabel="Enviar solicitud"
      onSubmit={(valores) => onPedir({ ...valores, bandaId: banda.id })}
      onClose={onClose}
    />
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
        <p className="text-xs text-slate-400 dark:text-slate-500">Para llantas</p>
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
        Pedir reencauche
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
  const [pedirCon, setPedirCon] = useState(null);

  // Si ya tiene solicitudes, abre en "Mis reencauches"; si no, en el catálogo
  const vistaActual = vista ?? (mis.filas.length ? 'mis' : 'bandas');
  // Primero lo que espera una respuesta del cliente, después lo que sigue en curso
  const prioridad = (s) =>
    s.estado === 'Cotizada' ? 0 : ['Por agendar', 'Agendada'].includes(s.estado) || (s.estado === 'Aceptada' && s.enProceso > 0) ? 1 : 2;
  const solicitudes = [...mis.filas].sort((a, b) => prioridad(a) - prioridad(b) || b.numero.localeCompare(a.numero));
  const abiertas = mis.filas.filter((s) => ['Por agendar', 'Agendada', 'Cotizada'].includes(s.estado) || (s.estado === 'Aceptada' && s.enProceso > 0)).length;

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
              <BandaCard key={b.id} banda={b} onPedir={setPedirCon} />
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
              onCancelar={() => mis.ejecutar(() => portalReencaucheService.cancelar(s.numero))}
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

      {pedirCon && (
        <PedirModal
          banda={pedirCon}
          medidaSugerida={medida}
          direccion={usuario?.direccion}
          onPedir={async (valores) => {
            await portalReencaucheService.solicitar(valores);
            await mis.recargar();
            setVista('mis');
          }}
          onClose={() => setPedirCon(null)}
        />
      )}
    </div>
  );
}
