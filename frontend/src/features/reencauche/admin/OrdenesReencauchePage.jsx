import { useMemo, useState } from 'react';
import { Ban, Check, Eye, FileText, HandCoins, PackageCheck, Search, Store, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import BotonAccion from '../../../components/base/BotonAccion';
import DataTable from '../../../components/base/DataTable';
import { DetalleDatos, DetalleImagen, DetalleResumen, DetalleSeccion } from '../../../components/base/Detalle';
import { BORDER_OK, INPUT, LABEL, formatoMiles } from '../../../components/base/formStyles';
import Modal from '../../../components/base/Modal';
import PageHeader from '../../../components/base/PageHeader';
import { DIAS_PARA_NO_PAGADA, estadosOrdenReencauche, mediosPago } from '../../../constantes';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { ordenesReencaucheService, tercerosService } from '../../../services';
import { formatCOP } from '../../../utils/formato';
import { opcionesEmpresas } from '../../../utils/opciones';
import { CamposPago, pideComprobante } from '../../shared/PagoConsignacion';
import { fechaCorta, llantasTexto, TONO_ORDEN } from '../reencauche';

const Segunda = ({ children }) => <p className="text-xs text-slate-400 dark:text-slate-500">{children}</p>;

// ---- Entrega y pago final de cada llanta -------------------------------------
// Solo se cobra al entregar; lo que la planta rechaza no se cobra y se devuelve.
// La que el cliente no paga ("No pagada") pasa al catálogo.

/** Días que le quedan a una llanta lista para que el cliente la pague. */
function diasParaPagar(o) {
  if (o.estado !== 'Lista para entregar' || !o.listaEn) return null;
  const desde = Date.parse(`${String(o.listaEn).slice(0, 10)}T00:00:00Z`);
  const transcurridos = Math.floor((Date.now() - desde) / 86_400_000);
  return Math.max(0, DIAS_PARA_NO_PAGADA - transcurridos);
}

/** Cómo va la entrega de una llanta al cliente. */
function entregaDe(o) {
  if (o.estado === 'Entregada') return { texto: 'Entregada', tono: 'Entregado', nota: fechaCorta(o.pagoFecha) };
  if (o.estado === 'Rechazada en planta') return { texto: 'Se devuelve', tono: 'Inactivo', nota: 'Sin reencauchar' };
  if (o.estado === 'No pagada') return { texto: 'No reclamada', tono: 'Inactivo', nota: 'Pasó al catálogo' };
  if (o.estado === 'Lista para entregar') {
    const dias = diasParaPagar(o);
    return { texto: 'Lista para entregar', tono: 'Pendiente', nota: dias == null ? null : `${dias} días para pagarla` };
  }
  return { texto: 'Pendiente', tono: 'Neutral', nota: o.estado === 'En planta' ? 'En la planta' : 'Por enviar a la planta' };
}

/** Cómo va el pago final de una llanta (el único cobro). */
function pagoDe(o) {
  if (o.estado === 'Entregada') return { texto: 'Pagado', tono: 'Pagado', nota: o.pagoMedio };
  if (o.estado === 'Rechazada en planta') return { texto: 'No se cobra', tono: 'Inactivo' };
  if (o.estado === 'No pagada') return { texto: 'No pagada', tono: 'Vencido', nota: o.productoCodigo ? `En venta · ${o.productoCodigo}` : 'En venta' };
  return { texto: 'Pendiente', tono: 'Pendiente', nota: 'Se cobra al entregar' };
}

const ESTADO_MAS_URGENTE = ['Lista para entregar', 'Por enviar', 'En planta', 'Entregada', 'No pagada', 'Rechazada en planta'];

/**
 * Agrupa las órdenes (una por llanta) por su solicitud de reencauche: la
 * cotización que aceptó el cliente. Cada grupo resume la entrega y el pago.
 */
function agrupar(ordenes) {
  const grupos = new Map();
  for (const o of ordenes) {
    if (!grupos.has(o.reencauche)) grupos.set(o.reencauche, []);
    grupos.get(o.reencauche).push(o);
  }
  return [...grupos.entries()].map(([numero, delGrupo]) => {
    // Dentro de la solicitud, las llantas en su orden de revisión
    const llantas = [...delGrupo].sort((x, y) => x.posicion - y.posicion);
    // Lo rechazado en la planta y lo que el cliente no pagó ya no se cobra
    const cobrables = llantas.filter((o) => !['Rechazada en planta', 'No pagada'].includes(o.estado));
    const entregadas = llantas.filter((o) => o.estado === 'Entregada');
    const cobrado = entregadas.reduce((s, o) => s + o.valor, 0);
    const total = cobrables.reduce((s, o) => s + o.valor, 0);
    return {
      id: numero,
      cliente: llantas[0].cliente,
      llantas,
      // El estado del grupo es el de la llanta que más pide atención
      estado: ESTADO_MAS_URGENTE.find((e) => llantas.some((o) => o.estado === e)),
      entregadas: entregadas.length,
      cobrables: cobrables.length,
      cobrado,
      porCobrar: total - cobrado,
      total,
      // Para que el buscador también encuentre la llanta, la banda o la planta
      buscable: llantas.map((o) => [o.identificador, o.banda, o.tercero, o.medida].join(' ')).join(' '),
    };
  });
}

/** Entrega del grupo: cuántas llantas ya recibió el cliente. */
function EntregaGrupo({ g }) {
  if (g.cobrables === 0) return <Badge tone="Inactivo">Se devuelven</Badge>;
  const completa = g.entregadas === g.cobrables;
  return (
    <div>
      <Badge tone={completa ? 'Entregado' : g.entregadas ? 'En proceso' : 'Neutral'}>
        {completa ? 'Entregada' : g.entregadas ? 'Parcial' : 'Pendiente'}
      </Badge>
      <Segunda>
        {g.entregadas} de {llantasTexto(g.cobrables)}
      </Segunda>
    </div>
  );
}

/** Pago final del grupo: lo cobrado y lo que falta por cobrar. */
function PagoGrupo({ g }) {
  if (g.total === 0) return <Badge tone="Inactivo">No se cobra</Badge>;
  return (
    <div>
      <Badge tone={g.porCobrar === 0 ? 'Pagado' : 'Pendiente'}>{g.porCobrar === 0 ? 'Pagado' : g.cobrado ? 'Parcial' : 'Pendiente'}</Badge>
      <Segunda>{g.porCobrar === 0 ? `${formatCOP(g.cobrado)} cobrado` : `Faltan ${formatCOP(g.porCobrar)}`}</Segunda>
    </div>
  );
}

const columns = [
  {
    key: 'id',
    label: 'Solicitud / Cliente',
    render: (g) => (
      <div>
        <p className="whitespace-nowrap font-semibold text-slate-800 dark:text-slate-100">{g.id}</p>
        <Segunda>{g.cliente}</Segunda>
      </div>
    ),
  },
  {
    key: 'celdaLlantas',
    label: 'Llantas',
    render: (g) => (
      <div>
        <p className="whitespace-nowrap">{llantasTexto(g.llantas.length)}</p>
        <Badge tone={TONO_ORDEN[g.estado]}>{g.estado}</Badge>
      </div>
    ),
  },
  { key: 'celdaEntrega', label: 'Entrega', render: (g) => <EntregaGrupo g={g} /> },
  { key: 'celdaPago', label: 'Pago final', render: (g) => <PagoGrupo g={g} /> },
  {
    key: 'total',
    label: 'Valor',
    render: (g) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatCOP(g.total)}</span>,
  },
];

/** Las llantas de una solicitud, con su estado, entrega, pago y acciones. */
function LlantasDelGrupo({ g, onAccion, onVer, onLista }) {
  return (
    <ul className="divide-y divide-slate-200/70 rounded-xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-brand-navy-800">
      {g.llantas.map((o) => {
        const entrega = entregaDe(o);
        const pago = pagoDe(o);
        return (
          <li key={o.id} className="grid items-center gap-x-5 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                Llanta {o.posicion} <span className="font-normal text-slate-400">· ID {o.identificador}</span>
              </p>
              <Segunda>
                {o.medida} · {o.banda}
              </Segunda>
            </div>
            <div>
              <Badge tone={TONO_ORDEN[o.estado]}>{o.estado}</Badge>
              {o.estado === 'Rechazada en planta' ? (
                <p className="mt-1 text-xs text-red-500">{o.motivoPlanta}</p>
              ) : (
                o.tercero && <Segunda>{o.tercero}</Segunda>
              )}
            </div>
            <div>
              <Badge tone={entrega.tono}>{entrega.texto}</Badge>
              {entrega.nota && <Segunda>{entrega.nota}</Segunda>}
            </div>
            <div>
              <Badge tone={pago.tono}>{pago.texto}</Badge>
              <p className={`mt-0.5 text-xs tabular-nums ${o.estado === 'Rechazada en planta' ? 'text-slate-400 line-through' : 'text-slate-500 dark:text-slate-400'}`}>
                {o.valorTexto}
                {pago.nota ? ` · ${pago.nota}` : ''}
              </p>
            </div>
            {/* Ver detalle primero; lo que no tiene vuelta atrás (rechazo de la planta) al final */}
            <div className="flex items-center justify-end gap-1">
              <BotonAccion icono={Eye} etiqueta="Ver detalle de la llanta" tono="acento" onClick={() => onVer(o)} />
              <BotonAccion
                icono={Truck}
                etiqueta="Enviar a la reencauchadora"
                tono={o.estado === 'Por enviar' ? 'destacado' : 'acento'}
                deshabilitado={o.estado !== 'Por enviar'}
                motivo="Ya salió hacia la planta"
                onClick={() => onAccion('envio', o)}
              />
              <BotonAccion
                icono={PackageCheck}
                etiqueta="La planta la devolvió reencauchada"
                tono="exito"
                deshabilitado={o.estado !== 'En planta'}
                motivo="Solo para las que están en la planta"
                onClick={() => onLista(o)}
              />
              <BotonAccion
                icono={HandCoins}
                etiqueta="Entregar y cobrar"
                tono="destacado"
                deshabilitado={o.estado !== 'Lista para entregar'}
                motivo="Se cobra cuando la planta la devuelve terminada"
                onClick={() => onAccion('entrega', o)}
              />
              <BotonAccion
                icono={Store}
                etiqueta="No pagada: pasarla al catálogo"
                tono="peligro"
                deshabilitado={o.estado !== 'Lista para entregar'}
                motivo="Solo para las que están listas para entregar"
                onClick={() => onAccion('noPagada', o)}
              />
              <BotonAccion
                icono={Ban}
                etiqueta="La planta la rechazó"
                tono="peligro"
                deshabilitado={o.estado !== 'En planta'}
                motivo="Solo para las que están en la planta"
                onClick={() => onAccion('rechazo', o)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Reencauchadoras a la vista para elegir con un clic (sin lista desplegable). */
function ElegirReencauchadora({ terceros, valor, onElegir }) {
  const [q, setQ] = useState('');
  const opciones = opcionesEmpresas(terceros);
  const visibles = opciones.filter((o) => `${o.etiqueta} ${o.detalle}`.toLowerCase().includes(q.trim().toLowerCase()));
  if (opciones.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No hay reencauchadoras activas. Regístralas en Terceros.</p>;
  }
  return (
    <div className="space-y-3">
      {opciones.length > 6 && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Razón social o NIT" className={`${INPUT} ${BORDER_OK} pl-9`} />
        </div>
      )}
      <div role="radiogroup" aria-label="Reencauchadora" className="grid gap-2 sm:grid-cols-2">
        {visibles.map((o) => {
          const marcada = o.valor === valor;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={marcada}
              onClick={() => onElegir(o.valor)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                marcada
                  ? 'border-amber-400 bg-amber-400/10'
                  : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  marcada ? 'border-amber-500 bg-amber-400' : 'border-slate-300 dark:border-white/30'
                }`}
              >
                {marcada && <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{o.etiqueta}</span>
                {o.detalle && <span className="block text-xs text-slate-400">{o.detalle}</span>}
              </span>
            </button>
          );
        })}
        {visibles.length === 0 && <p className="text-sm text-slate-400">Ninguna coincide con la búsqueda.</p>}
      </div>
    </div>
  );
}

/**
 * Ventana de cada paso que pide un dato: la reencauchadora al enviar, el
 * motivo si la planta la rechaza, o el método de pago al entregar (con la
 * cuenta y el comprobante si es por transferencia).
 */
function AccionOrdenModal({ tipo, orden, terceros, onConfirmar, onClose }) {
  const [valor, setValor] = useState('');
  const [pago, setPago] = useState({ medioPago: '', comprobante: '' });
  const { enviando, errorEnvio, enviar } = useEnvio();

  const CONFIG = {
    envio: { titulo: 'Enviar a la reencauchadora', boton: 'Enviar', icono: <Truck size={17} />, tamano: 'lg' },
    rechazo: { titulo: 'Rechazada en la planta', boton: 'Guardar rechazo', icono: <Ban size={17} />, tono: 'danger', tamano: 'md' },
    entrega: { titulo: 'Entregar y cobrar', boton: 'Registrar pago y entregar', icono: <HandCoins size={17} />, tamano: 'md' },
    noPagada: { titulo: 'No pagada: pasar al catálogo', boton: 'Pasar al catálogo', icono: <Store size={17} />, tono: 'danger', tamano: 'md' },
  }[tipo];

  const [motivo, setMotivo] = useState('');
  const listo =
    tipo === 'entrega'
      ? Boolean(pago.medioPago) && (!pideComprobante(pago.medioPago) || Boolean(pago.comprobante))
      : Boolean(String(valor).trim());
  const datos =
    tipo === 'entrega' ? pago : tipo === 'noPagada' ? { precioVenta: valor, motivo: motivo.trim() } : String(valor).trim();

  return (
    <Modal
      title={CONFIG.titulo}
      subtitle={`Llanta ${orden.posicion} · ID ${orden.identificador} · ${orden.reencauche} · ${orden.cliente}`}
      icon={CONFIG.icono}
      tone={CONFIG.tono}
      size={CONFIG.tamano}
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
            disabled={enviando || !listo}
            onClick={() => enviar(() => onConfirmar(datos), close)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
          >
            <Check size={16} /> {enviando ? 'Guardando…' : CONFIG.boton}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <AvisoError mensaje={errorEnvio} />

        {tipo === 'envio' && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {orden.medida} · {orden.banda}. Elige a qué reencauchadora sale hoy.
            </p>
            <ElegirReencauchadora terceros={terceros} valor={valor} onElegir={setValor} />
          </>
        )}

        {tipo === 'rechazo' && (
          <>
            <label className="block">
              <span className={LABEL}>Motivo que dio la reencauchadora</span>
              <textarea
                rows={3}
                maxLength={300}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ej.: separación interna detectada en la inspección de la planta"
                className={`${INPUT} ${BORDER_OK} resize-none`}
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">Esta llanta no se cobra. El cliente ve el motivo en su portal.</p>
          </>
        )}

        {tipo === 'noPagada' && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              La llanta queda <b>No pagada</b> y entra al catálogo como <b>Llanta reencauchada</b> (sin marca, categoría
              Reencauchadas, una sola unidad). Si nadie la marca, pasa sola a los {DIAS_PARA_NO_PAGADA} días.
            </p>
            <label className="block">
              <span className={LABEL}>
                Precio de venta en el catálogo <span className="text-red-500">*</span>
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input
                  inputMode="numeric"
                  value={valor}
                  onChange={(e) => setValor(formatoMiles(e.target.value))}
                  placeholder={formatoMiles(String(orden.valor ?? ''))}
                  className={`${INPUT} ${BORDER_OK} pl-7 tabular-nums`}
                />
              </div>
              <span className="mt-1 block text-xs text-slate-400">El reencauche se cotizó en {orden.valorTexto}.</span>
            </label>
            <label className="block">
              <span className={LABEL}>Motivo (opcional)</span>
              <textarea
                rows={2}
                maxLength={300}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej.: el cliente no volvió por la llanta"
                className={`${INPUT} ${BORDER_OK} resize-none`}
              />
            </label>
          </>
        )}

        {tipo === 'entrega' && (
          <>
            <dl className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm dark:bg-white/[0.03]">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">{orden.banda}</dt>
                <dd className="tabular-nums">{formatCOP(orden.precioBanda)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Mano de obra</dt>
                <dd className="tabular-nums">{formatCOP(orden.manoObra)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5 font-bold dark:border-white/10">
                <dt>Total a cobrar</dt>
                <dd className="tabular-nums">{orden.valorTexto}</dd>
              </div>
            </dl>
            {/* Por transferencia aparecen la cuenta y el pantallazo de la consignación */}
            <CamposPago pago={pago} onCambio={setPago} medios={mediosPago} etiqueta="Método de pago" />
          </>
        )}
      </div>
    </Modal>
  );
}

/** Todo lo de una llanta: lo que se le hizo, dónde está y su cobro. */
function DetalleLlantaModal({ orden: o, onClose }) {
  const entrega = entregaDe(o);
  const pago = pagoDe(o);
  return (
    <Modal
      title={`Llanta ${o.posicion} · ID ${o.identificador}`}
      subtitle={`${o.reencauche} · ${o.cliente}`}
      icon={<FileText size={17} />}
      size="md"
      onClose={onClose}
      footer={(close) => (
        <button
          type="button"
          onClick={close}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
        >
          Cerrar
        </button>
      )}
    >
      <div className="space-y-5">
        <DetalleResumen
          etiqueta={['Rechazada en planta', 'No pagada'].includes(o.estado) ? 'No se cobra' : 'Valor del reencauche'}
          valor={o.valorTexto}
          nota={`Banda ${formatCOP(o.precioBanda)} + mano de obra ${formatCOP(o.manoObra)}`}
          estado={o.estado}
          tonoEstado={TONO_ORDEN[o.estado]}
        />
        <DetalleDatos
          datos={[
            { etiqueta: 'Medida', valor: o.medida },
            { etiqueta: 'Banda', valor: o.banda },
            { etiqueta: 'Reencauches previos', valor: String(o.reencauchesPrevios ?? 0) },
            { etiqueta: 'Reencauchadora', valor: o.tercero },
            { etiqueta: 'Enviada', valor: fechaCorta(o.enviadaEn) },
            { etiqueta: 'Entrega', valor: <Badge tone={entrega.tono}>{entrega.texto}</Badge> },
            { etiqueta: 'Pago final', valor: <Badge tone={pago.tono}>{pago.texto}</Badge> },
            o.estado === 'Entregada' && { etiqueta: 'Pagado', valor: `${fechaCorta(o.pagoFecha)} · ${o.pagoMedio}` },
            o.motivoPlanta && { etiqueta: 'Motivo de la planta', valor: o.motivoPlanta, ancho: true },
            o.estado === 'No pagada' && { etiqueta: 'En el catálogo como', valor: o.productoCodigo },
            o.estado === 'No pagada' && { etiqueta: 'No pagada desde', valor: fechaCorta(o.noPagadaEn) },
            o.motivoNoPagada && { etiqueta: 'Por qué no se pagó', valor: o.motivoNoPagada, ancho: true },
          ]}
        />
        {o.pagoMedio === 'Transferencia' && (
          <DetalleSeccion titulo="Comprobante del pago">
            <DetalleImagen src={o.pagoComprobante} alt={`Comprobante del pago de la llanta ${o.identificador}`} />
          </DetalleSeccion>
        )}
      </div>
    </Modal>
  );
}

/**
 * Órdenes de reencauche: una por cada llanta apta que el cliente aceptó,
 * agrupadas por su solicitud (la cotización de reencauche). Arriba quedan
 * las que piden algo (listas para entregar y por enviar). No se recibe
 * dinero hasta que la reencauchadora entrega la llanta terminada.
 */
export default function OrdenesReencauchePage() {
  const ordenes = useRecurso(ordenesReencaucheService);
  const terceros = useRecurso(tercerosService);
  const navigate = useNavigate();
  // { tipo: 'envio' | 'rechazo' | 'entrega', orden }
  const [accion, setAccion] = useState(null);
  const [viendo, setViendo] = useState(null);

  const grupos = useMemo(() => agrupar(ordenes.filas), [ordenes.filas]);
  const cuenta = (estado) => ordenes.filas.filter((o) => o.estado === estado).length;
  const porCobrar = ordenes.filas
    .filter((o) => o.estado === 'Lista para entregar')
    .reduce((suma, o) => suma + o.valor, 0);

  const confirmar = (datos) => {
    const { tipo, orden } = accion;
    const operacion = {
      envio: () => ordenesReencaucheService.enviar(orden, datos),
      rechazo: () => ordenesReencaucheService.rechazar(orden, datos),
      entrega: () => ordenesReencaucheService.entregar(orden, datos),
      noPagada: () => ordenesReencaucheService.noPagada(orden, datos),
    }[tipo];
    return ordenes.ejecutar(operacion);
  };

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Reencauche', 'Órdenes']} />
      <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Órdenes de reencauche</h1>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>
          <b className="tabular-nums text-slate-800 dark:text-slate-100">{cuenta('Lista para entregar')}</b> listas para entregar
        </span>
        <span>
          <b className="tabular-nums text-slate-800 dark:text-slate-100">{cuenta('Por enviar')}</b> por enviar
        </span>
        <span>
          <b className="tabular-nums text-slate-800 dark:text-slate-100">{cuenta('En planta')}</b> en planta
        </span>
        <span>
          <b className="tabular-nums text-slate-800 dark:text-slate-100">{formatCOP(porCobrar)}</b> por cobrar al entregar
        </span>
      </p>

      <DataTable
        columns={columns}
        data={grupos}
        cargando={ordenes.cargando}
        error={ordenes.error}
        onRecargar={ordenes.recargar}
        exportable={false}
        canView={false}
        canEdit={false}
        canDelete={false}
        rowClassName={(g) => (g.estado === 'Lista para entregar' ? 'bg-amber-400/[0.06]' : '')}
        accionesIniciales={(g) => (
          <BotonAccion
            icono={Eye}
            etiqueta="Ver detalle de la solicitud"
            tono="acento"
            onClick={() => navigate(`/admin/reencauches/${encodeURIComponent(g.id)}`)}
          />
        )}
        expandir={(g) => (
          <LlantasDelGrupo
            g={g}
            onVer={setViendo}
            onAccion={(tipo, orden) => setAccion({ tipo, orden })}
            onLista={(o) => ordenes.ejecutar(() => ordenesReencaucheService.marcarLista(o))}
          />
        )}
        filters={[{ key: 'estado', label: 'Estado', options: estadosOrdenReencauche }]}
      />
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        Despliega cada solicitud para ver y mover sus llantas. ¿Buscas la revisión? Está en{' '}
        <Link to="/admin/reencauches" className="font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400">
          Revisiones
        </Link>
        .
      </p>

      {accion && (
        <AccionOrdenModal
          tipo={accion.tipo}
          orden={accion.orden}
          terceros={terceros.filas}
          onConfirmar={confirmar}
          onClose={() => setAccion(null)}
        />
      )}
      {viendo && <DetalleLlantaModal orden={viendo} onClose={() => setViendo(null)} />}
    </div>
  );
}
