import { CreditCard, Mail, MapPin, Phone, UserRound } from 'lucide-react';

/**
 * Tarjeta compacta con los datos del cliente elegido (documento, teléfono,
 * correo y dirección). Se muestra bajo el selector de cliente en los
 * formularios para confirmar de un vistazo a quién se le registra.
 *
 *   <ResumenCliente cliente={fichaSeleccionada} />
 *
 * `cliente` es una ficha de `/seleccion/clientes` (nombreCompleto,
 * tipoDocumento, numeroDocumento, telefono, correo, direccion). Si no hay
 * cliente, no pinta nada.
 */
const Dato = ({ icono: Icono, children }) =>
  children ? (
    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
      <Icono size={13} className="shrink-0 text-slate-400" /> {children}
    </span>
  ) : null;

export default function ResumenCliente({ cliente }) {
  if (!cliente) return null;
  const documento = cliente.numeroDocumento
    ? `${cliente.tipoDocumento ?? ''} ${cliente.numeroDocumento}`.trim()
    : '';
  return (
    <div className="ml-aparece mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <UserRound size={14} className="shrink-0 text-amber-500" /> {cliente.nombreCompleto}
      </p>
      <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <Dato icono={CreditCard}>{documento}</Dato>
        <Dato icono={Phone}>{cliente.telefono}</Dato>
        <Dato icono={Mail}>{cliente.correo}</Dato>
        <Dato icono={MapPin}>{cliente.direccion}</Dato>
      </div>
    </div>
  );
}
