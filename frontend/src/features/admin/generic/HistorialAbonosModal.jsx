import { useCallback, useEffect, useState } from 'react';
import { Plus, Receipt, Wallet } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import { DetalleDatos, DetalleResumen, DetalleSeccion } from '../../../components/base/Detalle';
import Modal from '../../../components/base/Modal';
import { CREDITO_SIN_INICIAR } from '../../../constantes';
import { usePrivilegio } from '../../../hooks/usePrivilegio';
import { abonosService, creditosService } from '../../../services';
import { formatCOP } from '../../../utils/formato';
import ComprobanteAbonoModal from '../../shared/ComprobanteAbonoModal';
import NuevoAbonoModal from './NuevoAbonoModal';
import { SkeletonLineas } from '../../../components/base/Skeleton';

/**
 * Abonos de un crédito de la cartera.
 *
 * Desde aquí el administrador ve el historial completo del crédito (lo
 * entrega el servicio de créditos), sube un abono nuevo sin salir de la
 * cartera y descarga el comprobante de los que ya están confirmados.
 */
export default function HistorialAbonosModal({ credito: inicial, onClose }) {
  const [credito, setCredito] = useState(inicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [comprobanteDe, setComprobanteDe] = useState(null);

  // Al abrir: el crédito con sus abonos. `vigente` evita guardar una
  // respuesta que llega cuando el modal ya se cerró.
  useEffect(() => {
    let vigente = true;
    creditosService
      .obtener(inicial.id)
      .then((completo) => vigente && setCredito(completo))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [inicial.id]);

  /** Vuelve a pedir el crédito (después de subir un abono). */
  const cargar = useCallback(async () => {
    try {
      setCredito(await creditosService.obtener(inicial.id));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [inicial.id]);

  /** Registra el abono y vuelve a pedir el historial. */
  const registrarAbono = async (datos) => {
    await abonosService.crear(datos);
    await cargar();
  };

  const historial = credito.abonos ?? [];
  const pagado = Number(credito.saldoValor) <= 0;
  const abonado = credito.montoTotalValor != null ? formatCOP(credito.montoTotalValor - credito.saldoValor) : '';
  const puede = usePrivilegio();

  return (
    <>
      <Modal
        title="Detalle del crédito"
        subtitle={`${credito.id} · ${credito.cliente}`}
        icon={<Wallet size={17} />}
        size="lg"
        onClose={onClose}
        footer={(close) => (
          <>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
            >
              Cerrar
            </button>
            {/* Un crédito pagado al 100 % o sin empezar no recibe abonos */}
            {puede('registrarAbono') && (
              <button
                type="button"
                onClick={() => setRegistrando(true)}
                disabled={pagado || !credito.iniciado}
                title={pagado ? 'El crédito ya está pagado' : !credito.iniciado ? 'Empieza cuando se pague la cuota inicial' : undefined}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} /> {pagado ? 'Crédito pagado' : 'Subir abono'}
              </button>
            )}
          </>
        )}
      >
        <div className="space-y-5">
          <AvisoError mensaje={error} />

          {/* ---- Estado del crédito ---- */}
          <DetalleResumen
            etiqueta="Saldo pendiente"
            valor={credito.saldoPendiente ?? '—'}
            nota={credito.montoTotal ? `De ${credito.montoTotal} · ${credito.iniciado ? 'en curso' : CREDITO_SIN_INICIAR}` : null}
            estado={credito.estado}
          />
          <DetalleDatos
            columnas={4}
            datos={[
              { etiqueta: 'Cotización', valor: credito.cotizacion },
              { etiqueta: 'Venta', valor: credito.venta },
              { etiqueta: 'Plazo', valor: credito.plazoDias ? `${credito.plazoDias} días` : '' },
              { etiqueta: 'Abonado', valor: abonado },
              { etiqueta: 'Apertura', valor: credito.fechaApertura },
              { etiqueta: 'Vence', valor: credito.iniciado ? credito.fechaLimite : '' },
            ]}
          />

          {/* ---- Historial ---- */}
          <DetalleSeccion titulo="Historial de abonos" icono={<Receipt size={15} />}>
            {historial.length === 0 && cargando ? (
              <SkeletonLineas lineas={4} className="rounded-xl border border-slate-200 p-4 dark:border-white/10" />
            ) : historial.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-white/10">
                Este crédito todavía no tiene abonos registrados.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                {historial.map((abono) => (
                  <li key={abono.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-500 dark:text-amber-400">
                      <Receipt size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {abono.id} · {abono.monto}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {abono.fecha} · {abono.metodoPago}
                      </p>
                    </div>
                    <Badge>{abono.estado}</Badge>
                    {/* El comprobante solo existe si el abono ya se validó */}
                    {abono.estado === 'Confirmado' && (
                      <button
                        type="button"
                        onClick={() => setComprobanteDe(abono)}
                        className="rounded-lg border border-amber-400 px-2.5 py-1.5 text-[11px] font-bold text-amber-600 hover:bg-amber-400/10 dark:text-amber-400"
                      >
                        Comprobante
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </DetalleSeccion>
        </div>
      </Modal>

      {registrando && (
        <NuevoAbonoModal creditoFijo={credito} onSubmit={registrarAbono} onClose={() => setRegistrando(false)} />
      )}
      {comprobanteDe && (
        <ComprobanteAbonoModal abono={comprobanteDe} onClose={() => setComprobanteDe(null)} />
      )}
    </>
  );
}
