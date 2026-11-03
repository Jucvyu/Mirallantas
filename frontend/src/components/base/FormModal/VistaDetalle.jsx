import Badge from '../Badge';
import { DetalleDatos, DetalleImagen, DetalleResumen, DetalleSeccion } from '../Detalle';
import Field from './Field';

/** Tipos que necesitan toda la fila para leerse bien. */
const A_LO_ANCHO = ['textarea', 'checkboxes'];

/** Valor legible de un campo del esquema, según su tipo. */
function valorDe(campo, valor) {
  const { type, options = [] } = campo;
  if (campo.key === 'estado' && valor) return <Badge>{valor}</Badge>;
  if (type === 'switch') return <Badge tone={valor === 'Sí' || valor === true ? 'Aprobado' : 'Inactivo'}>{valor === 'Sí' || valor === true ? 'Sí' : 'No'}</Badge>;
  if (type === 'select' || type === 'buscador') return options.find((o) => o?.valor === valor)?.etiqueta ?? valor;
  if (type === 'checkboxes') {
    const lista = String(valor ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    if (lista.length === 0) return null;
    return (
      <span className="flex flex-wrap gap-1.5">
        {lista.map((v) => (
          <span key={v} className="rounded-md bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {v}
          </span>
        ))}
      </span>
    );
  }
  if (type === 'color') {
    if (!valor) return null;
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-4 w-4 rounded ring-1 ring-black/10 dark:ring-white/20" style={{ backgroundColor: valor }} />
        <span className="font-mono text-xs uppercase">{valor}</span>
      </span>
    );
  }
  return valor;
}

/**
 * Detalle de un registro: lo que muestra el FormModal en modo "ver". Usa el
 * mismo esquema de campos del formulario, pero presenta los datos como texto:
 * nada de cajas de entrada, porque aquí no se edita nada.
 *
 * `resumen` = { titulo, estado } va arriba, para saber de un vistazo qué
 * registro se está viendo.
 */
export default function VistaDetalle({ sections, values, resumen }) {
  return (
    <div className="space-y-5">
      {resumen?.titulo && (
        <DetalleResumen
          icono={String(resumen.titulo).trim().charAt(0).toUpperCase()}
          valor={resumen.titulo}
          estado={resumen.estado}
        />
      )}
      {sections.map((seccion) => {
        const imagenes = seccion.fields.filter((c) => c.type === 'image' || c.type === 'avatar');
        const matrices = seccion.fields.filter((c) => c.type === 'privilegios');
        // El estado ya se ve en el resumen: no se repite en la lista
        const datos = seccion.fields.filter(
          (c) => !imagenes.includes(c) && !matrices.includes(c) && !(resumen?.estado && c.key === 'estado'),
        );
        if (datos.length + imagenes.length + matrices.length === 0) return null;
        return (
          <DetalleSeccion key={seccion.title ?? 'datos'} titulo={seccion.title}>
            <div className="space-y-3">
              {datos.length > 0 && (
                <DetalleDatos
                  datos={datos.map((c) => ({
                    etiqueta: c.label,
                    valor: valorDe(c, values[c.key]),
                    ancho: c.span === 2 || A_LO_ANCHO.includes(c.type),
                  }))}
                />
              )}
              {imagenes.map((c) => (
                <div key={c.key}>
                  <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
                  <DetalleImagen src={values[c.key]} alt={c.label} />
                </div>
              ))}
              {matrices.map((c) => (
                <Field key={c.key} field={c} value={values[c.key]} mode="view" onChange={() => {}} />
              ))}
            </div>
          </DetalleSeccion>
        );
      })}
    </div>
  );
}
