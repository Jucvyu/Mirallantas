import { Download, Mail, MapPin, Phone, Receipt } from 'lucide-react';
import Badge from '../../components/base/Badge';
import Modal from '../../components/base/Modal';
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
 * Comprobante de un abono confirmado.
 *
 * Solo se emite cuando el asesor ya validó la consignación: recoge el
 * crédito al que se aplicó, el monto, el medio de pago y los datos de la
 * empresa, y se puede descargar igual que el comprobante de venta.
 */
export default function ComprobanteAbonoModal({ abono, onClose }) {
  const { empresa: datosEmpresa, cargando: cargandoEmpresa } = useEmpresa();
  const empresa = datosEmpresa ?? EMPRESA_SIN_DATOS;

  /**
   * Descarga el comprobante como archivo de texto. Sin backend no hay
   * generador de PDF, así que el documento se arma en el navegador.
   */
  const descargar = () => {
    const ancho = 48;
    const contenido = [
      empresa.nombre.toUpperCase(),
      empresa.razonSocial,
      `NIT ${empresa.nit}`,
      empresa.direccion,
      empresa.telefono,
      '='.repeat(ancho),
      'COMPROBANTE DE ABONO',
      `Documento: ${abono.id}`,
      `Fecha:     ${abono.fecha}`,
      `Cliente:   ${abono.cliente ?? ''}`,
      `Crédito:   ${abono.credito}`,
      `Pago:      ${abono.metodoPago}`,
      '-'.repeat(ancho),
      'MONTO ABONADO'.padEnd(ancho - 14) + String(abono.monto).padStart(14),
      '='.repeat(ancho),
      empresa.correo,
      'Abono validado por MiraLlantas.',
    ].join('\n');

    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/plain;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `abono-${abono.id}.txt`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      title="Comprobante de abono"
      subtitle={`${abono.id} · ${abono.fecha}`}
      icon={<Receipt size={17} />}
      size="md"
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
        {/* Sin datos de la empresa no se inventan: se avisa */}
        {!datosEmpresa && !cargandoEmpresa && (
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs font-medium text-amber-700 dark:text-amber-400">
            Faltan los datos de la empresa (razón social, NIT, contacto). Un administrador los registra
            en Configuración › Empresa.
          </p>
        )}

        {/* ---- Encabezado de la empresa ---- */}
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
          <Badge>{abono.estado}</Badge>
        </header>

        {/* ---- Datos del abono ---- */}
        <dl className="space-y-3 text-sm">
          {[
            ['Cliente', abono.cliente],
            ['Crédito abonado', abono.credito],
            ['Fecha del abono', abono.fecha],
            ['Método de pago', abono.metodoPago],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">{etiqueta}</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100">{valor || '—'}</dd>
            </div>
          ))}
        </dl>

        {/* ---- Monto ---- */}
        <section className="flex items-center justify-between gap-4 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4">
          <span className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Monto abonado
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{abono.monto}</span>
        </section>

        {/* ---- Consignación adjunta ---- */}
        {abono.comprobante && (
          <figure>
            <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              Consignación adjunta
            </figcaption>
            <img
              src={abono.comprobante}
              alt="Consignación del abono"
              className="max-h-56 w-full rounded-xl border border-slate-200 object-contain dark:border-white/10"
            />
          </figure>
        )}

        {/* ---- Pie: contacto ---- */}
        <footer className="border-t border-slate-200 pt-5 dark:border-white/10">
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
            Documento generado automáticamente por el sistema.
          </p>
        </footer>
      </div>
    </Modal>
  );
}
