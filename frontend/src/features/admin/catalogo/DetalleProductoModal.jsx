import { Eye, FileText, Pencil, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from '../../../components/base/Badge';
import { DetalleDatos, DetalleResumen, DetalleSeccion } from '../../../components/base/Detalle';
import Modal from '../../../components/base/Modal';

/** Punto verde / rojo con el estado de una medida. */
function EstadoMedida({ estado }) {
  const activa = estado === 'Activo';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${activa ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      <span className={`h-2 w-2 rounded-full ${activa ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {estado}
    </span>
  );
}

const celda = 'px-3 py-2 text-left';
const valor = (v, sufijo = '') => (v === null || v === undefined || v === '' ? '—' : `${v}${sufijo}`);

/**
 * Detalle de un producto (modelo), de solo lectura: sus datos y la lista de
 * todas sus medidas con sus datos técnicos. Para cambiar algo se abre la
 * página del producto (botón "Editar producto").
 */
export default function DetalleProductoModal({ producto, onClose }) {
  const medidas = producto.referencias ?? [];
  const activas = medidas.filter((m) => m.estado === 'Activo').length;

  return (
    <Modal
      title="Detalle del producto"
      subtitle={`${producto.marca ?? ''} · ${producto.categoria ?? ''}`}
      icon={<Eye size={16} />}
      size="lg"
      onClose={onClose}
      footer={(close) => (
        <>
          <Link
            to={`/admin/productos/${producto.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
          >
            <Pencil size={14} /> Editar producto
          </Link>
          <button
            type="button"
            onClick={close}
            className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300"
          >
            Cerrar
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <DetalleResumen
          icono={
            producto.foto ? (
              <img src={producto.foto} alt="" className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              String(producto.nombre ?? '').charAt(0).toUpperCase()
            )
          }
          valor={producto.nombre}
          nota={`${medidas.length} ${medidas.length === 1 ? 'medida' : 'medidas'} · ${activas} activas`}
          estado={producto.estado}
        />

        <DetalleDatos
          columnas={3}
          datos={[
            { etiqueta: 'Marca', valor: producto.marca },
            { etiqueta: 'Categoría', valor: producto.categoria },
            { etiqueta: 'Tipo de vehículo', valor: producto.tipoVehiculo },
            producto.uso && { etiqueta: 'Uso', valor: producto.uso },
            producto.labrado && { etiqueta: 'Labrado', valor: producto.labrado },
            producto.construccion && { etiqueta: 'Construcción', valor: producto.construccion },
            producto.sinCamara && { etiqueta: 'Sin cámara', valor: producto.sinCamara },
            producto.recauchable && { etiqueta: 'Reencauchable', valor: producto.recauchable },
            producto.garantiaMeses && { etiqueta: 'Garantía', valor: `${producto.garantiaMeses} meses` },
            producto.paisOrigen && { etiqueta: 'País de origen', valor: producto.paisOrigen },
            producto.descripcion && { etiqueta: 'Descripción', valor: producto.descripcion, ancho: true },
          ]}
        />

        <DetalleSeccion titulo="Medidas" icono={<Ruler size={15} />} accion={<Badge>{medidas.length}</Badge>}>
          {medidas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
              Este producto todavía no tiene medidas y no sale en el catálogo.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                  <tr>
                    <th className={celda}>Medida</th>
                    <th className={celda}>Posición</th>
                    <th className={celda}>Índice de carga</th>
                    <th className={celda}>Lonas</th>
                    <th className={celda}>Labrado</th>
                    <th className={celda}>Peso</th>
                    <th className={celda}>Código</th>
                    <th className={celda}>Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-slate-700 dark:divide-white/5 dark:text-slate-200">
                  {medidas.map((m) => (
                    <tr key={m.id}>
                      <td className={`${celda} font-semibold tabular-nums text-slate-900 dark:text-white`}>{m.medidas}</td>
                      <td className={celda}>{valor(m.posicion)}</td>
                      <td className={celda}>{valor(m.indiceCarga)}</td>
                      <td className={`${celda} tabular-nums`}>{valor(m.lonasValor)}</td>
                      <td className={`${celda} tabular-nums`}>{valor(m.profundidadValor, ' mm')}</td>
                      <td className={`${celda} tabular-nums`}>{valor(m.pesoValor, ' kg')}</td>
                      <td className={`${celda} text-xs text-slate-500 dark:text-slate-400`}>{valor(m.codigoFabricante || m.codigo)}</td>
                      <td className={celda}>
                        <EstadoMedida estado={m.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DetalleSeccion>

        {producto.fichaPdf && (
          <a
            href={producto.fichaPdf}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:underline dark:text-amber-400"
          >
            <FileText size={14} /> Ver ficha técnica (PDF)
          </a>
        )}
      </div>
    </Modal>
  );
}
