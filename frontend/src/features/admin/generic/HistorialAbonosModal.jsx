import { useCallback, useEffect, useState } from 'react';
import { Plus, Receipt, Wallet } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import Modal from '../../../components/base/Modal';
import { abonosService, creditosService } from '../../../services';
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

  return (
    <>
      <Modal
        title="Abonos del crédito"
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
            {/* Un crédito pagado al 100 % ya no recibe abonos */}
            <button
              type="button"
              onClick={() => setRegistrando(true)}
              disabled={pagado}
              title={pagado ? 'El crédito ya está pagado' : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} /> {pagado ? 'Crédito pagado' : 'Subir abono'}
            </button>
          </>
        )}
      >
        <div className="space-y-6">
          <AvisoError mensaje={error} />

          {/* ---- Estado del crédito ---- */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Monto total', credito.montoTotal],
              ['Saldo pendiente', credito.saldoPendiente],
              ['Plazo', `${credito.plazoDias} días`],
              ['Vence', credito.fechaLimite],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {etiqueta}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{valor}</p>
              </div>
            ))}
          </section>

          {/* ---- Historial ---- */}
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              Historial de abonos
            </p>

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
          </section>
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
