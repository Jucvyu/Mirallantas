import { Download, Mail, MapPin, Package, Phone, Receipt, Wrench } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Modal from '../../components/base/Modal';
import { useDetalle } from '../../hooks/useDetalle';
import { useEmpresa } from '../../hooks/useEmpresa';

/**
 * Lo que se muestra mientras la empresa no registre sus datos reales
 * (Configuración › Empresa). Nunca se inventa un NIT ni una dirección.
 */
const EMPRESA_SIN_DATOS = {
  nombre: 'MiraLlantas',
  razonSocial: 'Datos de la empresa sin registrar',
  nit: '—',
  direccion: '—',
  ciudad: '',
  telefono: '—',
  correo: '—',
};

/**
 * Comprobante de venta de una cotización cerrada.
 *
 * No lo captura nadie: se arma solo con lo que ya quedó registrado en el
 * pedido-cotización (cliente, fecha, líneas y total confirmado). Lo usan
 * el administrador ("Generar comprobante") y el cliente ("Ver recibo").
 *
 * Si el documento llega sin líneas (desde un listado), se las pide a su
 * `servicio` (cotizacionesService o ventasService).
 */
export default function ComprobanteVentaModal({ venta: inicial, servicio, titulo = 'Comprobante de venta', onClose }) {
  const { documento: venta, cargando, error } = useDetalle(inicial, servicio);
  const { empresa: datosEmpresa, cargando: cargandoEmpresa } = useEmpresa();
  const empresa = datosEmpresa ?? EMPRESA_SIN_DATOS;
  const lineas = venta.detalle ?? [];

  /**
   * Descarga el comprobante como archivo de texto.
   *
   * Sin backend no hay generador de PDF, así que se arma el documento en el
   * navegador y se baja con un enlace temporal; al conectar el servicio real
   * basta con cambiar el contenido del blob.
   */
  const descargar = () => {
    const ancho = 56;
    const filas = lineas
      .map((l) => `  ${l.cantidad} x ${l.nombre} (${l.medida})`.padEnd(ancho - 14) + String(l.subtotal).padStart(14))
      .join('\n');

    const contenido = [
      empresa.nombre.toUpperCase(),
      empresa.razonSocial,
      `NIT ${empresa.nit}`,
      empresa.direccion,
      empresa.telefono,
      '='.repeat(ancho),
      `${titulo.toUpperCase()}`,
      `Documento: ${venta.id}`,
      `Fecha:     ${venta.fecha ?? ''}`,
      `Cliente:   ${venta.cliente}`,
      `Pago:      ${venta.metodoPago ?? '-'}`,
      '-'.repeat(ancho),
      'ITEMS',
      filas || '  (sin líneas registradas)',
      '-'.repeat(ancho),
      `TOTAL`.padEnd(ancho - 14) + String(venta.total).padStart(14),
      '='.repeat(ancho),
      empresa.correo,
      `Gracias por comprar en ${empresa.nombre}.`,
    ].join('\n');

    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/plain;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `comprobante-${venta.id}.txt`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      title={titulo}
      subtitle={`${venta.id} · ${venta.fecha ?? ''}`}
      icon={<Receipt size={17} />}
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
          <button
            type="button"
            onClick={descargar}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300"
          >
            <Download size={16} /> Descargar
          </button>
        </>
      )}
    >
      <div className="space-y-6">
        <AvisoError mensaje={error} />
        {/* Sin datos de la empresa no se inventan: se avisa */}
        {!datosEmpresa && !cargandoEmpresa && (
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs font-medium text-amber-700 dark:text-amber-400">
            Faltan los datos de la empresa (razón social, NIT, contacto). Un administrador los registra
            en Configuración › Empresa.
          </p>
        )}

        {/* ================= Encabezado: datos de MiraLlantas ================= */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-sm font-bold text-slate-900">
              ML
            </span>
            <div>
              <p className="text-base font-bold text-amber-500 dark:text-amber-400">{empresa.nombre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{empresa.razonSocial}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">NIT {empresa.nit}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              Comprobante
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{venta.id}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{venta.fecha}</p>
          </div>
        </header>

        {/* ================= Datos del cliente y del pago ================= */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Cliente
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{venta.cliente}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Método de pago
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
              {venta.metodoPago ?? '—'}
            </p>
          </div>
        </section>

        {/* ================= Ítems de la factura ================= */}
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Ítems
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-brand-navy-900">
                <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2.5">Descripción</th>
                  <th className="px-4 py-2.5 text-center">Cant.</th>
                  <th className="px-4 py-2.5 text-right">Unitario</th>
                  <th className="px-4 py-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr
                    key={`${venta.id}-${i}`}
                    className="border-t border-slate-100 text-slate-600 dark:border-white/5 dark:text-slate-300"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                            l.tipo === 'servicio'
                              ? 'bg-blue-500/15 text-blue-500 dark:text-blue-400'
                              : 'bg-amber-400/15 text-amber-500 dark:text-amber-400'
                          }`}
                        >
                          {l.tipo === 'servicio' ? <Wrench size={12} /> : <Package size={12} />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{l.nombre}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{l.medida}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{l.cantidad}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{l.unitario}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">
                      {l.subtotal}
                    </td>
                  </tr>
                ))}

                {lineas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                      {cargando ? 'Cargando las líneas…' : 'El documento no tiene líneas registradas.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ================= Total ================= */}
        <section className="flex items-center justify-between gap-4 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4">
          <span className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Total de la cotización
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{venta.total}</span>
        </section>

        {/* ================= Financiación, si la hubo ================= */}
        {venta.metodoPago === 'Crédito' && (
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
              Financiación
            </p>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Interés aplicado</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{venta.interes ?? '$ 0'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Cuota inicial</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{venta.cuotaInicial ?? '$ 0'}</dd>
              </div>
            </dl>
          </section>
        )}

        {/* ================= Pie: contacto ================= */}
        <footer className="border-t border-slate-200 pt-5 dark:border-white/10">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Contacto
          </p>
          <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <li className="flex items-center gap-2">
              <MapPin size={13} className="shrink-0 text-amber-500 dark:text-amber-400" />
              {[empresa.direccion, empresa.ciudad].filter(Boolean).join(' · ')}
            </li>
            <li className="flex items-center gap-2">
              <Phone size={13} className="shrink-0 text-amber-500 dark:text-amber-400" />
              {empresa.telefono}
            </li>
            <li className="flex items-center gap-2">
              <Mail size={13} className="shrink-0 text-amber-500 dark:text-amber-400" />
              {empresa.correo}
            </li>
          </ul>
          <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Gracias por comprar en {empresa.nombre}. Documento generado automáticamente por el sistema.
          </p>
        </footer>
      </div>
    </Modal>
  );
}
