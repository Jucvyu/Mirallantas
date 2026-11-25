import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, CalendarDays, IdCard, Mail, MapPin, Phone, UserRound } from 'lucide-react';
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
  const agendada = solicitud.estado === 'Agendada' || solicitud.estado === 'Por confirmar';
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={LABEL}>{agendada ? 'Cambiar la fecha' : 'Fecha de la revisión'}</span>
        <span className="mb-1.5 block text-xs text-slate-400">
          Si no es el {fechaCorta(solicitud.fechaPreferida)} (lo que pidió), el cliente debe confirmarla.
        </span>
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

/** La fecha propuesta espera al cliente: si la aceptó por teléfono, se anota aquí. */
function FechaPorConfirmar({ solicitud: s, onConfirmar }) {
  const { enviando, errorEnvio, enviar } = useEnvio();
  return (
    <div className="rounded-xl border border-yellow-400/70 bg-yellow-300/20 p-4 dark:border-yellow-400/40 dark:bg-yellow-400/10">
      <p className="flex items-start gap-2 text-sm font-semibold text-yellow-900 dark:text-yellow-200">
        <CalendarClock size={17} className="mt-0.5 shrink-0" />
        Esperando confirmación del cliente
      </p>
      <p className="mt-1 text-sm text-yellow-900/80 dark:text-yellow-100/80">
        Pidió el {fechaCorta(s.fechaPreferida)} y se le propuso el <b>{fechaCorta(s.fechaRevision)}</b>. La revisión se registra
        cuando confirme en el portal.
      </p>
      <AvisoError mensaje={errorEnvio} className="mt-2" />
      <button
        type="button"
        disabled={enviando}
        onClick={() => enviar(onConfirmar)}
        className="mt-3 w-full rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-yellow-300 disabled:opacity-60"
      >
        {enviando ? 'Guardando…' : 'El cliente la aceptó por teléfono'}
      </button>
    </div>
  );
}

/** Lo que pidió el cliente: una fila por banda, con la medida y cuántas llantas. */
function ItemsPedidos({ items }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-semibold text-slate-400 dark:border-white/10 dark:text-slate-500">
            <th className="py-2 pr-3 font-semibold">Banda</th>
            <th className="py-2 pr-3 font-semibold">Diseño</th>
            <th className="py-2 pr-3 font-semibold">Medida</th>
            <th className="py-2 text-right font-semibold">Llantas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {items.map((i) => (
            <tr key={`${i.bandaId}-${i.medida}`}>
              <td className="py-2.5 pr-3 font-semibold text-slate-800 dark:text-slate-100">
                {i.banda}
                {i.anchoMm && <span className="ml-1.5 text-xs font-normal text-slate-400">{i.anchoMm} mm</span>}
              </td>
              <td className="py-2.5 pr-3">{i.diseno && <DisenoBanda diseno={i.diseno} />}</td>
              <td className="py-2.5 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{i.medida}</td>
              <td className="py-2.5 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">{i.cantidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const cancelable = ['Por agendar', 'Por confirmar', 'Agendada'].includes(s.estado);
  const confirmarFecha = tras(() => reencauchesService.confirmarFecha(s.numero));
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
        <div className="mt-4">
          <Agenda solicitud={s} onGuardar={agendar} />
        </div>
      </div>
    );
  } else if (s.estado === 'Por confirmar') {
    principal = (
      <div className="space-y-4 p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Revisión de las llantas</h2>
        <FechaPorConfirmar solicitud={s} onConfirmar={confirmarFecha} />
      </div>
    );
  } else if (porRevisar) {
    principal = (
      <div className="p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Revisión de las llantas</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">
          Anota cada llanta y si sirve (su ID lo asigna el sistema). A las aptas asígnales la banda según su medida y su valor.
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
            {s.cliente} · {llantasTexto(s.cantidad)} · {s.items.length} {s.items.length === 1 ? 'banda' : 'bandas'}
          </p>
        </div>
        <Badge tone={TONO_SOLICITUD[s.estado]}>{s.estado}</Badge>
      </div>

      <AvisoError mensaje={error} className="mb-4" />

      {/* Lo más importante (el cliente y lo que pidió) va a la izquierda, en
          grande; la revisión de las llantas, a la derecha y más angosta.
          Antes de 1280 px la revisión se ubica debajo. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="min-w-0 space-y-5">
          <section className={PANEL}>
            <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/5">
              <UserRound size={17} className="text-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Información del cliente</h2>
            </header>
            <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
              <Dato etiqueta="Nombre">
                <span className="text-base font-semibold">{s.cliente}</span>
              </Dato>
              <Dato etiqueta="Documento">
                <span className="flex items-center gap-1.5">
                  <IdCard size={14} className="text-slate-400" />
                  {s.documentoCliente ? `${s.tipoDocumentoCliente ?? ''} ${s.documentoCliente}`.trim() : '—'}
                </span>
              </Dato>
              <Dato etiqueta="Teléfono">
                {s.telefonoCliente ? (
                  <a href={`tel:${s.telefonoCliente}`} className="flex items-center gap-1.5 hover:text-amber-600">
                    <Phone size={14} className="text-slate-400" /> {s.telefonoCliente}
                  </a>
                ) : (
                  '—'
                )}
              </Dato>
              <Dato etiqueta="Correo">
                {s.correoCliente ? (
                  <a href={`mailto:${s.correoCliente}`} className="flex items-center gap-1.5 break-all hover:text-amber-600">
                    <Mail size={14} className="shrink-0 text-slate-400" /> {s.correoCliente}
                  </a>
                ) : (
                  '—'
                )}
              </Dato>
              <Dato etiqueta="Dirección del cliente">
                <span className="flex items-start gap-1.5">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  {s.direccionCliente || '—'}
                </span>
              </Dato>
              <Dato etiqueta="Pedida el">{fechaCorta(s.creadoEn)}</Dato>
            </dl>
          </section>

          <section className={PANEL}>
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Lo que pidió</h2>
              <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{llantasTexto(s.cantidad)} en total</span>
            </header>
            <div className="px-5 pb-4 pt-1">
              <ItemsPedidos items={s.items} />
            </div>
            <dl className="grid gap-x-6 gap-y-4 border-t border-slate-100 p-5 dark:border-white/5 sm:grid-cols-2">
              <Dato etiqueta="Revisión (gratis)">
                <span className="flex items-start gap-1.5">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  {s.lugar === 'Local' ? 'En el local' : s.direccion}
                </span>
              </Dato>
              <Dato etiqueta={s.fechaRevision ? (s.estado === 'Por confirmar' ? 'Fecha propuesta (por confirmar)' : 'Fecha agendada') : 'Fecha que prefiere'}>
                <span className={s.estado === 'Por confirmar' ? 'rounded bg-yellow-300/40 px-1.5 py-0.5 font-semibold text-yellow-900 dark:bg-yellow-400/20 dark:text-yellow-200' : ''}>
                  {fechaCorta(s.fechaRevision ?? s.fechaPreferida)}
                </span>
                {s.fechaRevision && s.fechaRevision !== s.fechaPreferida && (
                  <span className="mt-0.5 block text-xs text-slate-400">Pidió el {fechaCorta(s.fechaPreferida)}</span>
                )}
              </Dato>
              {s.notas && (
                <div className="sm:col-span-2">
                  <Dato etiqueta="Notas del cliente">{s.notas}</Dato>
                </div>
              )}
              {s.estado === 'Cancelada' && (
                <div className="sm:col-span-2">
                  <Dato etiqueta="Motivo de la cancelación">
                    <span className="text-red-600 dark:text-red-400">{s.motivoCancelacion}</span>
                  </Dato>
                </div>
              )}
            </dl>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className={`${PANEL} min-w-0`}>{principal}</section>

          {cancelable && (
            <div className={`${PANEL} space-y-4 p-5`}>
              {['Agendada', 'Por confirmar'].includes(s.estado) && <Agenda solicitud={s} onGuardar={agendar} />}
              <Cancelar onCancelar={tras((motivo) => reencauchesService.cancelar(s.numero, motivo))} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
