import { useState } from 'react';
import { Download, Mail, MapPin, Phone, Receipt } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Badge from '../../components/base/Badge';
import Modal from '../../components/base/Modal';
import { useEmpresa } from '../../hooks/useEmpresa';
import { abonosService } from '../../services';

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
 * empresa, y se descarga en PDF tipo tirilla (80 mm), como un recibo de caja.
 */
export default function ComprobanteAbonoModal({ abono, onClose }) {
  const { empresa: datosEmpresa, cargando: cargandoEmpresa } = useEmpresa();
  const empresa = datosEmpresa ?? EMPRESA_SIN_DATOS;

  // El PDF (tirilla de 80 mm) lo genera la API con los datos guardados del abono
  const [descargando, setDescargando] = useState(false);
  const [errorPdf, setErrorPdf] = useState('');
  const descargar = () => {
    setErrorPdf('');
    setDescargando(true);
    abonosService
      .descargarPdf(abono.id)
      .catch((e) => setErrorPdf(e.message))
      .finally(() => setDescargando(false));
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
            disabled={descargando}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:opacity-60"
          >
            <Download size={16} /> {descargando ? 'Descargando…' : 'Descargar PDF'}
          </button>
        </>
      )}
    >
      <div className="space-y-6">
        <AvisoError mensaje={errorPdf} />
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
