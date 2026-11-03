import { Receipt, ReceiptText } from 'lucide-react';
import { DetalleAviso, DetalleDatos, DetalleImagen, DetalleResumen, DetalleSeccion } from '../../components/base/Detalle';
import Modal from '../../components/base/Modal';

/**
 * Detalle de un abono del cliente.
 *
 * Se abre al pulsar el abono en la cartera y responde a lo que el cliente
 * quiere confirmar de un pago que ya hizo: cuánto abonó, en qué estado va
 * la validación y qué consignación quedó adjunta. El pantallazo se muestra
 * completo, no recortado, porque es la prueba del pago.
 */
export default function DetalleAbonoModal({ abono, onClose }) {
  return (
    <Modal
      title="Detalle del abono"
      subtitle={`${abono.id} · ${abono.credito}`}
      icon={<Receipt size={17} />}
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
        {/* ---- Monto y estado, lo primero que se busca ---- */}
        <DetalleResumen etiqueta="Monto abonado" valor={abono.monto} estado={abono.estado} />

        {/* ---- Rechazado: por qué, y qué hacer ---- */}
        {abono.estado === 'Rechazado' && (
          <DetalleAviso tono="peligro">
            Motivo: {abono.motivoRechazo || 'el comprobante no se pudo validar.'} Vuelve a subir el abono desde la tarjeta
            del crédito.
          </DetalleAviso>
        )}
        {abono.estado === 'Pendiente' && (
          <DetalleAviso>
            Un asesor está validando la consignación. Al confirmarla, el saldo de tu crédito se actualiza.
          </DetalleAviso>
        )}

        <DetalleDatos
          datos={[
            { etiqueta: 'Crédito', valor: abono.credito },
            { etiqueta: 'Fecha del pago', valor: abono.fecha },
            { etiqueta: 'Método de pago', valor: abono.metodoPago },
          ]}
        />

        <DetalleSeccion titulo="Comprobante de pago" icono={<ReceiptText size={15} />}>
          <DetalleImagen
            src={abono.comprobante}
            alt={`Comprobante del abono ${abono.id}`}
            vacio="Este pago se hizo en el local, sin comprobante adjunto."
          />
        </DetalleSeccion>
      </div>
    </Modal>
  );
}
