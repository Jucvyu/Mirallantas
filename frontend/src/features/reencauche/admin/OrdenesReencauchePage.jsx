import { useState } from 'react';
import { Ban, Check, HandCoins, PackageCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import BotonAccion from '../../../components/base/BotonAccion';
import DataTable from '../../../components/base/DataTable';
import { BORDER_OK, INPUT, LABEL } from '../../../components/base/formStyles';
import Modal from '../../../components/base/Modal';
import PageHeader from '../../../components/base/PageHeader';
import SearchSelect from '../../../components/base/SearchSelect';
import { estadosOrdenReencauche, mediosPago } from '../../../constantes';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { ordenesReencaucheService, tercerosService } from '../../../services';
import { formatCOP } from '../../../utils/formato';
import { opcionesEmpresas } from '../../../utils/opciones';
import { fechaCorta, TONO_ORDEN } from '../reencauche';

const Segunda = ({ children }) => <p className="text-xs text-slate-400 dark:text-slate-500">{children}</p>;

/** Lo que se dice del cobro de cada orden: solo se cobra al entregar. */
function cobro(o) {
  if (o.estado === 'Entregada') return `Pagado ${fechaCorta(o.pagoFecha)} · ${o.pagoMedio}`;
  if (o.estado === 'Rechazada en planta') return 'No se cobra';
  if (o.estado === 'Lista para entregar') return 'Se cobra al entregar';
  return 'Sin cobro todavía';
}

// Claves propias de cada celda (no las del dato): así la tabla deja bajar de
// línea el texto secundario. Cuatro columnas más las acciones: caben sin desplazarse de lado desde
// 1024 px; en pantallas más pequeñas cada orden se ve como tarjeta
const columns = [
  {
    key: 'celdaLlanta',
    label: 'Llanta',
    render: (o) => (
      <div>
        <p className="whitespace-nowrap font-semibold text-slate-800 dark:text-slate-100">DOT {o.dot}</p>
        <Segunda>
          {o.medida} · {o.banda}
        </Segunda>
      </div>
    ),
  },
  {
    key: 'celdaSolicitud',
    label: 'Solicitud',
    render: (o) => (
      <div>
        <Link
          to={`/admin/reencauches/${encodeURIComponent(o.reencauche)}`}
          className="whitespace-nowrap font-medium text-slate-700 hover:text-amber-600 dark:text-slate-200 dark:hover:text-amber-400"
        >
          {o.reencauche}
        </Link>
        <Segunda>{o.cliente}</Segunda>
      </div>
    ),
  },
  {
    key: 'celdaEstado',
    label: 'Estado',
    render: (o) => (
      <div>
        <Badge tone={TONO_ORDEN[o.estado]}>{o.estado}</Badge>
        {o.estado === 'Rechazada en planta' ? (
          <p className="mt-1 text-xs text-red-500">{o.motivoPlanta}</p>
        ) : (
          o.tercero && <p className="mt-1 text-xs text-slate-400">{o.tercero}</p>
        )}
      </div>
    ),
  },
  {
    key: 'celdaValor',
    label: 'Valor',
    render: (o) => (
      <div>
        <p
          className={`whitespace-nowrap font-semibold tabular-nums ${
            o.estado === 'Rechazada en planta' ? 'text-slate-400 line-through' : ''
          }`}
        >
          {o.valorTexto}
        </p>
        <Segunda>{cobro(o)}</Segunda>
      </div>
    ),
  },
];

/**
 * Ventana corta de cada paso que pide un dato: la reencauchadora al enviar,
 * el motivo si la planta la rechaza, o el medio de pago al entregar.
 */
function AccionOrdenModal({ tipo, orden, terceros, onConfirmar, onClose }) {
  const [valor, setValor] = useState(tipo === 'entrega' ? (mediosPago[0] ?? '') : '');
  const { enviando, errorEnvio, enviar } = useEnvio();

  const CONFIG = {
    envio: { titulo: 'Enviar a la reencauchadora', boton: 'Enviar', icono: <Truck size={17} /> },
    rechazo: { titulo: 'Rechazada en la planta', boton: 'Guardar rechazo', icono: <Ban size={17} />, tono: 'danger' },
    entrega: { titulo: 'Entregar y cobrar', boton: 'Registrar pago y entregar', icono: <HandCoins size={17} /> },
  }[tipo];

  return (
    <Modal
      title={CONFIG.titulo}
      subtitle={`DOT ${orden.dot} · ${orden.reencauche} · ${orden.cliente}`}
      icon={CONFIG.icono}
      tone={CONFIG.tono}
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
            disabled={enviando || !String(valor).trim()}
            onClick={() => enviar(() => onConfirmar(String(valor).trim()), close)}
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
          <div>
            <span className={LABEL}>Reencauchadora</span>
            <SearchSelect
              value={valor}
              options={opcionesEmpresas(terceros)}
              onChange={setValor}
              placeholderBusqueda="Razón social o NIT"
            />
          </div>
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
            <label className="block">
              <span className={LABEL}>Medio de pago</span>
              <select value={valor} onChange={(e) => setValor(e.target.value)} className={`${INPUT} ${BORDER_OK} cursor-pointer`}>
                {mediosPago.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Órdenes de reencauche: una por cada llanta apta que el cliente aceptó.
 * Arriba quedan las que piden algo (listas para entregar y por enviar). No
 * se recibe dinero hasta que la reencauchadora entrega la llanta terminada.
 */
export default function OrdenesReencauchePage() {
  const ordenes = useRecurso(ordenesReencaucheService);
  const terceros = useRecurso(tercerosService);
  // { tipo: 'envio' | 'rechazo' | 'entrega', orden }
  const [accion, setAccion] = useState(null);

  const cuenta = (estado) => ordenes.filas.filter((o) => o.estado === estado).length;
  const porCobrar = ordenes.filas
    .filter((o) => o.estado === 'Lista para entregar')
    .reduce((suma, o) => suma + o.valor, 0);

  const confirmar = (valor) => {
    const { tipo, orden } = accion;
    const operacion = {
      envio: () => ordenesReencaucheService.enviar(orden, valor),
      rechazo: () => ordenesReencaucheService.rechazar(orden, valor),
      entrega: () => ordenesReencaucheService.entregar(orden, valor),
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
        data={ordenes.filas}
        cargando={ordenes.cargando}
        error={ordenes.error}
        onRecargar={ordenes.recargar}
        exportable={false}
        canView={false}
        canEdit={false}
        canDelete={false}
        rowClassName={(o) => (o.estado === 'Lista para entregar' ? 'bg-amber-400/[0.06]' : '')}
        rowActions={(o) => (
          <>
            <BotonAccion
              icono={Truck}
              etiqueta="Enviar a la reencauchadora"
              tono="acento"
              deshabilitado={o.estado !== 'Por enviar'}
              motivo="Ya salió hacia la planta"
              onClick={() => setAccion({ tipo: 'envio', orden: o })}
            />
            <BotonAccion
              icono={PackageCheck}
              etiqueta="La planta la devolvió reencauchada"
              tono="exito"
              deshabilitado={o.estado !== 'En planta'}
              motivo="Solo para las que están en la planta"
              onClick={() => ordenes.ejecutar(() => ordenesReencaucheService.marcarLista(o))}
            />
            <BotonAccion
              icono={Ban}
              etiqueta="La planta la rechazó"
              tono="peligro"
              deshabilitado={o.estado !== 'En planta'}
              motivo="Solo para las que están en la planta"
              onClick={() => setAccion({ tipo: 'rechazo', orden: o })}
            />
            <BotonAccion
              icono={HandCoins}
              etiqueta="Entregar y cobrar"
              tono="destacado"
              deshabilitado={o.estado !== 'Lista para entregar'}
              motivo="Se cobra cuando la planta la devuelve terminada"
              onClick={() => setAccion({ tipo: 'entrega', orden: o })}
            />
          </>
        )}
        filters={[{ key: 'estado', label: 'Estado', options: estadosOrdenReencauche }]}
      />

      {accion && (
        <AccionOrdenModal
          tipo={accion.tipo}
          orden={accion.orden}
          terceros={terceros.filas}
          onConfirmar={confirmar}
          onClose={() => setAccion(null)}
        />
      )}
    </div>
  );
}
