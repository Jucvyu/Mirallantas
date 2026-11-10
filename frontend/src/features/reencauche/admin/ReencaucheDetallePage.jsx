import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, Phone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import { BORDER_OK, INPUT, LABEL } from '../../../components/base/formStyles';
import PageHeader from '../../../components/base/PageHeader';
import Skeleton from '../../../components/base/Skeleton';
import { DIAS_MAXIMOS_REVISION } from '../../../constantes';
import { useAlCambiar } from '../../../hooks/useAlCambiar';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { bandasService, reencauchesService } from '../../../services';
import { hoyISO } from '../../../utils/formato';
import DisenoBanda from '../DisenoBanda';
import LlantasLista from '../LlantasLista';
import { fechaCorta, llantasTexto, TONO_SOLICITUD } from '../reencauche';
import RevisionLlantas from './RevisionLlantas';

const PANEL = 'rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800';
const BOTON_SECUNDARIO =
  'rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700';
const BOTON_PRINCIPAL =
  'ml-pulsable rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60';

/** Fecha límite para agendar: hoy + DIAS_MAXIMOS_REVISION. */
const fechaMaxima = () => {
  const d = new Date();
  d.setDate(d.getDate() + DIAS_MAXIMOS_REVISION);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Un dato del resumen lateral: etiqueta pequeña y valor. */
function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{children}</dd>
    </div>
  );
}

/** Agendar (o cambiar) la fecha de la revisión, sin abrir otra ventana. */
function Agenda({ solicitud, onGuardar }) {
  const [fecha, setFecha] = useState(solicitud.fechaRevision ?? (solicitud.fechaPreferida >= hoyISO() ? solicitud.fechaPreferida : hoyISO()));
  const { enviando, errorEnvio, enviar } = useEnvio();
  const agendada = solicitud.estado === 'Agendada';
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={LABEL}>{agendada ? 'Cambiar la fecha' : 'Fecha de la revisión'}</span>
        <input
          type="date"
          value={fecha}
          min={hoyISO()}
          max={fechaMaxima()}
          onChange={(e) => setFecha(e.target.value)}
          className={`${INPUT} ${BORDER_OK}`}
        />
      </label>
      <AvisoError mensaje={errorEnvio} />
      <button
        type="button"
        disabled={enviando || !fecha || fecha === solicitud.fechaRevision}
        onClick={() => enviar(() => onGuardar(fecha))}
        className={`${agendada ? BOTON_SECUNDARIO : BOTON_PRINCIPAL} w-full`}
      >
        {enviando ? 'Guardando…' : agendada ? 'Cambiar fecha' : 'Agendar revisión'}
      </button>
    </div>
  );
}

/** Cancelar la solicitud antes de la revisión: pide el motivo ahí mismo. */
function Cancelar({ onCancelar }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { enviando, errorEnvio, enviar } = useEnvio();
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-sm font-semibold text-red-500 hover:text-red-600">
        Cancelar solicitud
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={LABEL}>Motivo de la cancelación</span>
        <textarea
          rows={2}
          value={motivo}
          maxLength={300}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: el cliente ya no necesita el reencauche"
          className={`${INPUT} ${BORDER_OK} resize-none`}
        />
      </label>
      <AvisoError mensaje={errorEnvio} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setAbierto(false)} className={`${BOTON_SECUNDARIO} flex-1`}>
          Volver
        </button>
        <button
          type="button"
          disabled={enviando || !motivo.trim()}
          onClick={() => enviar(() => onCancelar(motivo.trim()))}
          className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
        >
          {enviando ? 'Cancelando…' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}

/** Respuesta del cliente a la cotización, cuando la da en el local. */
function Respuesta({ onResponder }) {
  const { enviando, errorEnvio, enviar } = useEnvio();
  return (
    <div className="space-y-3">
      <AvisoError mensaje={errorEnvio} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={enviando} onClick={() => enviar(() => onResponder(false))} className={BOTON_SECUNDARIO}>
          No aceptó
        </button>
        <button type="button" disabled={enviando} onClick={() => enviar(() => onResponder(true))} className={BOTON_PRINCIPAL}>
          Aceptó en el local
        </button>
      </div>
    </div>
  );
}

/**
 * Detalle de una solicitud de reencauche. A la izquierda va lo que se
 * trabaja (la revisión de cada llanta o lo que se encontró); a la derecha,
 * el resumen del pedido y las acciones de agenda.
 */
export default function ReencaucheDetallePage() {
  const { numero } = useParams();
  const bandas = useRecurso(bandasService);
  const [solicitud, setSolicitud] = useState(null);
  const [error, setError] = useState('');
  const [corrigiendo, setCorrigiendo] = useState(false);

  /** Vuelve a pedir la solicitud (después de guardar algo). */
  const cargar = useCallback(async () => {
    try {
      setSolicitud(await reencauchesService.obtener(numero));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [numero]);

  // Primera carga. `vigente` evita guardar una respuesta que llega tarde
  useEffect(() => {
    let vigente = true;
    reencauchesService
      .obtener(numero)
      .then((datos) => vigente && setSolicitud(datos))
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [numero]);

  // Si el cliente responde desde el portal (u otro asesor cambia algo), se
  // ve aquí al instante, sin recargar la página
  useAlCambiar(cargar);

  /** Ejecuta una acción y vuelve a cargar lo que quedó guardado. */
  const tras = (accion) => async (...argumentos) => {
    await accion(...argumentos);
    setCorrigiendo(false);
    await cargar();
  };

  const volver = (
    <Link
      to="/admin/reencauches"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
    >
      <ArrowLeft size={15} /> Revisiones
    </Link>
  );

  if (!solicitud) {
    return (
      <div>
        <PageHeader crumbs={['Inicio', 'Reencauche', 'Revisiones', numero]} />
        {volver}
        <AvisoError mensaje={error} />
        {!error && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </div>
    );
  }

  const s = solicitud;
  const porRevisar = s.estado === 'Agendada' || (s.estado === 'Cotizada' && corrigiendo);
  const cancelable = s.estado === 'Por agendar' || s.estado === 'Agendada';
  const revisar = tras((llantas) => reencauchesService.registrarRevision(s.numero, llantas));

  // ---- Lo que se trabaja en la columna principal, según el estado ----------
  const agendar = tras((fecha) => reencauchesService.agendar(s.numero, fecha));

  let principal;
  if (s.estado === 'Por agendar') {
    principal = (
      <div className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <CalendarDays size={18} className="text-amber-500" /> Agenda la revisión
        </h2>
        <p className="mt-1 max-w-prose text-sm text-slate-500 dark:text-slate-400">
          Llama a {s.cliente}
          {s.telefonoCliente ? ` (${s.telefonoCliente})` : ''} y acuerden la fecha. Prefiere el{' '}
          {fechaCorta(s.fechaPreferida)}, {s.lugar === 'Local' ? 'en el local' : 'en su dirección'}. Cuando revisen las
          llantas, las anotas aquí.
        </p>
        <div className="mt-4 max-w-xs">
          <Agenda solicitud={s} onGuardar={agendar} />
        </div>
      </div>
    );
  } else if (porRevisar) {
    principal = (
      <div className="p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Revisión de las llantas</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">
          Anota el ID de cada llanta y si sirve. A las aptas asígnales la banda según su medida y su valor.
        </p>
        <RevisionLlantas
          key={`${s.numero}-${s.revisadoEn ?? 'nueva'}`}
          solicitud={s}
          bandas={bandas.filas}
          onEmitir={revisar}
          onCancelar={corrigiendo ? () => setCorrigiendo(false) : undefined}
        />
      </div>
    );
  } else {
    const mensajes = {
      Cotizada: 'Cotización enviada. El cliente la acepta desde el portal o aquí, si está en el local. No paga nada hasta recibir sus llantas.',
      Aceptada: 'El cliente aceptó. Cada llanta apta sigue su orden en "Órdenes de reencauche" y se cobra al entregarla.',
      'No aceptada': 'El cliente no aceptó la cotización. Devuélvele sus llantas sin costo.',
      'Sin llantas aptas': 'Ninguna llanta sirvió para reencauche. Se devuelven sin costo.',
      Cancelada: `Solicitud cancelada. Motivo: ${s.motivoCancelacion}`,
    };
    principal = (
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {s.llantas.length ? 'Llantas revisadas' : 'Solicitud cerrada'}
          </h2>
          {s.estado === 'Cotizada' && (
            <button type="button" onClick={() => setCorrigiendo(true)} className="text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400">
              Corregir revisión
            </button>
          )}
          {s.estado === 'Aceptada' && (
            <Link to="/admin/ordenes-reencauche" className="text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400">
              Ver órdenes
            </Link>
          )}
        </div>
        <p className="mt-1 max-w-prose text-sm text-slate-500 dark:text-slate-400">{mensajes[s.estado]}</p>
        {s.llantas.length > 0 && (
          <div className="mt-4">
            <LlantasLista llantas={s.llantas} />
          </div>
        )}
        {s.llantas.length > 0 && (
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4 border-t border-slate-200 pt-4 dark:border-white/10">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {s.aptas} de {llantasTexto(s.revisadas)} sirven
                {s.estado === 'Aceptada' && ` · ${s.entregadas} entregadas`}
              </p>
              <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{s.valorTexto}</p>
              {s.cobrado > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400">Cobrado: {s.cobradoTexto}</p>}
            </div>
            {s.estado === 'Cotizada' && <Respuesta onResponder={tras((acepta) => reencauchesService.responder(s.numero, acepta))} />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Reencauche', 'Revisiones', s.numero]} />
      {volver}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{s.numero}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {s.cliente} · {llantasTexto(s.cantidad)} {s.medida}
          </p>
        </div>
        <Badge tone={TONO_SOLICITUD[s.estado]}>{s.estado}</Badge>
      </div>

      <AvisoError mensaje={error} className="mb-4" />

      {/* El resumen va a la derecha solo cuando el formulario conserva su ancho
          (desde 1280 px); antes se ubica debajo */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className={`${PANEL} min-w-0`}>{principal}</section>

        <aside className={`${PANEL} divide-y divide-slate-100 dark:divide-white/5`}>
          <dl className="space-y-3 p-5">
            <Dato etiqueta="Cliente">
              <span className="font-semibold">{s.cliente}</span>
              {s.telefonoCliente && (
                <span className="mt-0.5 flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Phone size={13} /> {s.telefonoCliente}
                </span>
              )}
            </Dato>
            <Dato etiqueta="Banda pedida">
              <span className="block">{s.banda}</span>
              <span className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <DisenoBanda diseno={s.diseno} /> {s.anchoMm} mm
              </span>
            </Dato>
            <Dato etiqueta="Llantas">
              {llantasTexto(s.cantidad)} · {s.medida}
            </Dato>
            {s.notas && <Dato etiqueta="Notas del cliente">{s.notas}</Dato>}
          </dl>

          <dl className="space-y-3 p-5">
            <Dato etiqueta="Revisión (gratis)">
              <span className="flex items-start gap-1.5">
                <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                {s.lugar === 'Local' ? 'En el local' : s.direccion}
              </span>
            </Dato>
            <Dato etiqueta={s.fechaRevision ? 'Fecha agendada' : 'Fecha que prefiere'}>
              {fechaCorta(s.fechaRevision ?? s.fechaPreferida)}
            </Dato>
          </dl>

          {cancelable && (
            <div className="space-y-4 p-5">
              {s.estado === 'Agendada' && <Agenda solicitud={s} onGuardar={agendar} />}
              <Cancelar onCancelar={tras((motivo) => reencauchesService.cancelar(s.numero, motivo))} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
