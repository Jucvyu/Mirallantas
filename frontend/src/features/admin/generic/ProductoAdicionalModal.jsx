import { useMemo, useState } from 'react';
import { Check, PackagePlus } from 'lucide-react';
import Modal from '../../../components/base/Modal';
import SearchSelect from '../../../components/base/SearchSelect';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL, formatoMiles, soloDigitos } from '../../../components/base/formStyles';
import { useRecurso } from '../../../hooks/useRecurso';
import { proveedoresService } from '../../../services';
import { formatCOP, parseCOP } from '../../../utils/formato';
import { opcionesEmpresas } from '../../../utils/opciones';

/**
 * Producto que no estaba en la cotización de origen: antes de sumarlo a la
 * compra se elige a qué proveedor se le compra y a qué precio (los dos son
 * obligatorios). `onConfirmar({ proveedorId, proveedor, precioCompra, cantidad })`.
 */
export default function ProductoAdicionalModal({ producto, onConfirmar, onClose }) {
  const proveedores = useRecurso(proveedoresService);
  const opciones = useMemo(() => opcionesEmpresas(proveedores.filas), [proveedores.filas]);

  const [proveedorId, setProveedorId] = useState('');
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [tocado, setTocado] = useState(false);

  const errores = {
    proveedor: proveedorId ? '' : 'Elige el proveedor.',
    precio: parseCOP(precio) > 0 ? '' : 'Indica el precio de compra.',
    cantidad: Number(cantidad) >= 1 && Number(cantidad) <= 999 ? '' : 'La cantidad va de 1 a 999.',
  };
  const hayErrores = Object.values(errores).some(Boolean);

  const confirmar = (cerrar) => {
    setTocado(true);
    if (hayErrores) return;
    onConfirmar({
      proveedorId,
      proveedor: opciones.find((o) => o.valor === proveedorId)?.etiqueta ?? '',
      precioCompra: parseCOP(precio),
      cantidad: Number(cantidad),
    });
    cerrar();
  };

  const error = (campo) => tocado && errores[campo] && <p className="mt-1 text-xs font-medium text-red-500">{errores[campo]}</p>;

  return (
    <Modal
      title="Producto adicional"
      subtitle={`${producto.nombre} · ${producto.medidas || producto.codigo}`}
      icon={<PackagePlus size={17} />}
      size="sm"
      onClose={onClose}
      footer={(cerrar) => (
        <>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => confirmar(cerrar)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300"
          >
            <Check size={15} /> Agregar a la compra
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
          Este producto no está en la cotización de origen: indica a qué proveedor se le compra y a qué precio.
        </p>
        <div>
          <label htmlFor="adicional-proveedor" className={LABEL}>
            Proveedor <span className="text-red-500">*</span>
          </label>
          <SearchSelect
            id="adicional-proveedor"
            value={proveedorId}
            options={opciones}
            onChange={setProveedorId}
            placeholder="Buscar proveedor…"
            placeholderBusqueda="Razón social o NIT"
            error={Boolean(tocado && errores.proveedor)}
          />
          {error('proveedor')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="adicional-precio" className={LABEL}>
              Precio de compra <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                id="adicional-precio"
                inputMode="numeric"
                value={precio}
                onChange={(e) => setPrecio(formatoMiles(e.target.value))}
                placeholder="0"
                className={`${INPUT} ${tocado && errores.precio ? BORDER_ERR : BORDER_OK} pl-7`}
              />
            </div>
            {error('precio')}
          </div>
          <div>
            <label htmlFor="adicional-cantidad" className={LABEL}>
              Cantidad <span className="text-red-500">*</span>
            </label>
            <input
              id="adicional-cantidad"
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(soloDigitos(e.target.value))}
              className={`${INPUT} ${tocado && errores.cantidad ? BORDER_ERR : BORDER_OK}`}
            />
            {error('cantidad')}
          </div>
        </div>
        {parseCOP(precio) > 0 && Number(cantidad) > 0 && (
          <p className="text-right text-xs text-slate-500 dark:text-slate-400">
            Subtotal: <span className="font-bold text-slate-800 dark:text-slate-100">{formatCOP(parseCOP(precio) * Number(cantidad))}</span>
          </p>
        )}
      </div>
    </Modal>
  );
}
