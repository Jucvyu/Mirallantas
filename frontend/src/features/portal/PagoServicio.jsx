import { useRef, useState } from 'react';
import { CheckCircle2, Clock, HandCoins, ImagePlus, TriangleAlert, X } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Modal from '../../components/base/Modal';
import { BORDER_ERR, BORDER_OK, INPUT } from '../../components/base/formStyles';
import { MEDIOS_PAGO_CLIENTE } from '../../constantes';
import { useEnvio } from '../../hooks/useEnvio';
import { portalService } from '../../services';
import { leerImagen, TIPOS_IMAGEN } from '../../utils/imagenes';
import DatosTransferencia from '../shared/DatosTransferencia';

// =========================================================================
// Pago de un servicio de reencauche, en el portal del cliente.
//
// El servicio no se cobra en la cotización. El camino es:
//   Sin precio  → un asesor revisa la llanta y le pone valor.
//   Por pagar   → el cliente paga y sube el comprobante.
//   En revisión → el asesor revisa el pago.
//   Aprobado    → el reencauche sigue sus estados normales.
//   Rechazado   → se muestra en rojo con el motivo y se vuelve a subir.
// =========================================================================

/** Aviso del estado del pago con su color. */
function Estado({ tono, icono: Icono, children }) {
  const colores = {
    gris: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300',
    ambar: 'bg-amber-400/15 text-amber-700 dark:text-amber-300',
    azul: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    rojo: 'bg-red-500/10 text-red-600 dark:text-red-400',
    verde: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  };
  return (
    <div className={`flex items-start gap-2 rounded-md px-3 py-2 text-[11px] font-medium ${colores[tono]}`}>
      <Icono size={14} className="mt-px shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Formulario para pagar el servicio (o volver a subir el comprobante). */
function PagarServicioModal({ servicio, onPagado, onClose }) {
  const [medio, setMedio] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [errorArchivo, setErrorArchivo] = useState('');
  const archivo = useRef(null);
  const { enviando, errorEnvio, enviar } = useEnvio();
  const requiereComprobante = medio && medio !== 'Efectivo';

  const cargar = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    leerImagen(file)
      .then((dataUrl) => {
        setComprobante(dataUrl);
        setErrorArchivo('');
      })
      .catch((error) => setErrorArchivo(error.message));
  };

  const pagar = (cerrar) =>
    enviar(async () => {
      await portalService.pagarServicio(servicio.id, { medioPago: medio, comprobante });
      await onPagado?.();
    }, cerrar);

  return (
    <Modal
      title={servicio.pagoEstado === 'Rechazado' ? 'Volver a subir el pago' : 'Pagar el servicio'}
      subtitle={`${servicio.id} · ${servicio.servicio}`}
      icon={<HandCoins size={17} />}
      size="md"
      onClose={onClose}
      footer={(cerrar) => (
        <button
          type="button"
          onClick={() => pagar(cerrar)}
          disabled={enviando || !medio || (requiereComprobante && !comprobante)}
          className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar pago'}
        </button>
      )}
    >
      <div className="space-y-4">
        <AvisoError mensaje={errorEnvio} />
        <section className="flex items-center justify-between rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Valor del servicio</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{servicio.precioTexto}</span>
        </section>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Medio de pago</span>
          <select
            value={medio}
            onChange={(e) => setMedio(e.target.value)}
            className={`${INPUT} ${BORDER_OK} mt-1.5 cursor-pointer`}
          >
            <option value="">Seleccionar...</option>
            {MEDIOS_PAGO_CLIENTE.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {medio === 'Efectivo' && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Paga en el local; un asesor confirmará el pago.
          </p>
        )}

        {medio === 'Transferencia' && <DatosTransferencia />}
        {requiereComprobante && (
          <div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Comprobante del pago</span>
            {comprobante ? (
              <div className="relative mt-1.5 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                <img src={comprobante} alt="Comprobante" className="max-h-56 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => setComprobante('')}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white"
                  aria-label="Quitar el comprobante"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => archivo.current?.click()}
                className={`mt-1.5 flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-slate-400 hover:border-amber-400 hover:text-amber-500 ${
                  errorArchivo ? BORDER_ERR : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <ImagePlus size={24} strokeWidth={1.5} />
                <span className="text-xs font-medium">Sube el pantallazo de la consignación</span>
              </button>
            )}
            <input ref={archivo} type="file" accept={TIPOS_IMAGEN} className="hidden" onChange={cargar} />
            {errorArchivo && <p className="mt-1 text-xs font-medium text-red-500">{errorArchivo}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Bloque del pago dentro del detalle del servicio. `servicio` es
 * `linea.solicitudDatos` (ver adaptadores.js). `onPagado` recarga el portal.
 */
export default function PagoServicio({ servicio, onPagado }) {
  const [pagando, setPagando] = useState(false);
  const puedePagar = ['Por pagar', 'Rechazado'].includes(servicio.pagoEstado);

  return (
    <div className="mt-2 space-y-2">
      {servicio.pagoEstado === 'Sin precio' && (
        <Estado tono="gris" icono={Clock}>
          Un asesor está revisando tu llanta para darle valor al servicio. Te avisaremos.
        </Estado>
      )}
      {servicio.pagoEstado === 'Por pagar' && (
        <Estado tono="ambar" icono={HandCoins}>
          El valor del servicio es <strong>{servicio.precioTexto}</strong>. Realiza el pago para empezar el reencauche.
        </Estado>
      )}
      {servicio.pagoEstado === 'En revisión' && (
        <Estado tono="azul" icono={Clock}>
          Tu pago de <strong>{servicio.precioTexto}</strong> ({servicio.pagoMedio}) está en revisión.
        </Estado>
      )}
      {servicio.pagoEstado === 'Rechazado' && (
        <Estado tono="rojo" icono={TriangleAlert}>
          <strong>Pago rechazado.</strong> {servicio.pagoMotivo} Vuelve a subir el comprobante.
        </Estado>
      )}
      {servicio.pagoEstado === 'Aprobado' && (
        <Estado tono="verde" icono={CheckCircle2}>
          Pago de <strong>{servicio.precioTexto}</strong> aprobado.
        </Estado>
      )}

      {servicio.pagoComprobante && servicio.pagoEstado !== 'Rechazado' && (
        <a href={servicio.pagoComprobante} target="_blank" rel="noreferrer" className="block" title="Ver el comprobante">
          <img
            src={servicio.pagoComprobante}
            alt="Comprobante del pago"
            className="max-h-40 w-full rounded-md border border-slate-200 object-contain dark:border-white/10"
          />
        </a>
      )}

      {puedePagar && (
        <button
          type="button"
          onClick={() => setPagando(true)}
          className={`flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-bold transition-colors ${
            servicio.pagoEstado === 'Rechazado'
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-amber-400 text-slate-900 hover:bg-amber-300'
          }`}
        >
          <HandCoins size={12} />
          {servicio.pagoEstado === 'Rechazado' ? 'Volver a subir el comprobante' : 'Pagar el servicio'}
        </button>
      )}

      {pagando && <PagarServicioModal servicio={servicio} onPagado={onPagado} onClose={() => setPagando(false)} />}
    </div>
  );
}
