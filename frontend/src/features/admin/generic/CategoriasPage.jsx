import { useMemo, useState } from 'react';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { categoriasService, productosService } from '../../../services';
import { CAMPOS_OCULTABLES, ocultosATexto, textoAOcultos } from '../productos/camposProducto';

/** Las casillas guardan etiquetas; la API, las claves de los datos. */
const conOcultos = (valores) => ({ ...valores, camposOcultosClaves: textoAOcultos(valores.camposOcultosTexto) });

// Tabla `categoria`: nombre, descripcion, color, estado. El color se usa
// para marcar la categoría en el catálogo del cliente. Al desactivarla, la
// base desactiva también sus productos (migración 0019).
const formSections = [
  {
    title: 'Datos de la categoría',
    fields: [
      { key: 'nombre', label: 'Nombre', required: true, span: 2, placeholder: 'Turismo' },
      { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2 },
      { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] },
    ],
  },
  {
    // Migración 0042: lo que se marca aquí no se pide al registrar un producto
    title: 'Datos que no aplican a esta categoría',
    fields: [
      {
        key: 'camposOcultosTexto',
        label: 'Marca los datos que estas llantas no llevan',
        type: 'checkboxes',
        span: 2,
        options: CAMPOS_OCULTABLES.map((c) => c.etiqueta),
        grupos: ['Medidas', 'Ficha técnica'].map((titulo) => ({
          titulo,
          opciones: CAMPOS_OCULTABLES.filter((c) => c.grupo === titulo).map((c) => c.etiqueta),
        })),
        hint: 'Por ejemplo, una llanta de moto no lleva lonas ni posición. Esos campos no se pedirán al registrar sus productos.',
      },
    ],
  },
  {
    title: 'Color',
    fields: [
      {
        key: 'color',
        label: 'Color de la categoría',
        type: 'color',
        span: 2,
        hint: 'Es el color con el que se marca la categoría en el catálogo del cliente.',
      },
    ],
  },
];

export default function CategoriasPage() {
  const categorias = useRecurso(categoriasService);
  // Para el formulario: los datos que no aplican, como texto de casillas
  const filas = useMemo(
    () => categorias.filas.map((c) => ({ ...c, camposOcultosTexto: ocultosATexto(c.camposOcultos) })),
    [categorias.filas],
  );
  // Los productos se piden solo para contar cuántos hay en cada categoría
  const productos = useRecurso(productosService);
  // Categoría con productos activos que se va a desactivar (se confirma antes)
  const [desactivando, setDesactivando] = useState(null);

  const productosActivosDe = (categoria) => productos.filas.filter((p) => p.categoriaId === categoria.id && p.activo).length;

  const cambiarEstado = (fila, estado) => {
    if (estado === 'Inactivo' && productosActivosDe(fila) > 0) {
      setDesactivando(fila);
      return Promise.resolve();
    }
    return categorias.ejecutar(() => categoriasService.cambiarEstado(fila, estado)).then(productos.recargar);
  };

  const columns = [
    {
      key: 'nombre',
      label: 'Categoría',
      render: (row) => (
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
            style={{ backgroundColor: row.color ?? '#94A3B8' }}
          />
          {row.nombre}
        </span>
      ),
    },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'estado', label: 'Estado' },
  ];

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Categorías']} />
      <DataTable
        title="Categorías"
        columns={columns}
        data={filas}
        cargando={categorias.cargando}
        error={categorias.error}
        onRecargar={categorias.recargar}
        onCreate={(valores) => categorias.crear(conOcultos(valores))}
        onEdit={(fila, valores) => categorias.editar(fila, conOcultos(valores))}
        onStatusChange={cambiarEstado}
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        newLabel="Nueva categoría"
        formSections={formSections}
        entityName="categoría"
        exportable={false}
        canView={false}
        canDelete={false}
        filters={[{ key: 'estado', label: 'Estado', options: estadosActivo }]}
      />

      {desactivando && (
        <ConfirmDialog
          title="¿Desactivar la categoría?"
          message={`También se desactivarán sus ${productosActivosDe(desactivando)} productos activos: dejarán de verse en el catálogo. Si luego reactivas la categoría, los productos se activan uno por uno.`}
          confirmLabel="Desactivar"
          record={{ title: desactivando.nombre, subtitle: desactivando.descripcion }}
          onConfirm={() =>
            categorias.ejecutar(() => categoriasService.cambiarEstado(desactivando, 'Inactivo')).then(productos.recargar)
          }
          onClose={() => setDesactivando(null)}
        />
      )}
    </div>
  );
}
