import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../../components/base/DataTable';
import PageHeader from '../../../components/base/PageHeader';
import { disenosBanda, estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { bandasService, productosService, tiposVehiculoService } from '../../../services';
import DisenoBanda from '../DisenoBanda';

/** Profundidad en milímetros con un decimal como máximo: 16 o 16.5 */
const PROFUNDIDAD = /^\d{1,2}([.,]\d)?$/;

/** Medidas compatibles como pastillas que bajan de línea si no caben. */
function Medidas({ lista }) {
  return (
    <div className="flex flex-wrap gap-1">
      {lista.map((m) => (
        <span
          key={m}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-white/5 dark:text-slate-300"
        >
          {m}
        </span>
      ))}
    </div>
  );
}

const columns = [
  {
    key: 'nombre',
    label: 'Banda',
    render: (b) => (
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">{b.nombre}</p>
        <p className="text-xs text-slate-400">
          {b.codigo} · {b.tipoVehiculo}
        </p>
      </div>
    ),
  },
  { key: 'diseno', label: 'Diseño', render: (b) => <DisenoBanda diseno={b.diseno} /> },
  {
    key: 'anchoMm',
    label: 'Ancho',
    render: (b) => (
      <div className="whitespace-nowrap tabular-nums">
        <p>{b.anchoMm} mm</p>
        <p className="text-xs text-slate-400">prof. {b.profundidadMm} mm</p>
      </div>
    ),
  },
  { key: 'medidasTexto', label: 'Para llantas', render: (b) => <Medidas lista={b.medidas} /> },
  { key: 'precio', label: 'Precio banda', render: (b) => <span className="tabular-nums">$ {b.precio}</span> },
  { key: 'estado', label: 'Estado' },
];

function secciones({ tipos, medidas }) {
  return [
    {
      title: 'Banda',
      fields: [
        { key: 'nombre', label: 'Nombre', required: true, span: 2, max: 80, placeholder: 'Banda tracción 220' },
        {
          key: 'diseno',
          label: 'Diseño',
          type: 'select',
          required: true,
          options: disenosBanda.map((d) => d.nombre),
          emptyLabel: 'diseño de banda',
          hint: disenosBanda.map((d) => `${d.nombre}: ${d.descripcion.toLowerCase().replace(/\.$/, '')}`).join(' · '),
        },
        {
          key: 'tipoVehiculoId',
          label: 'Tipo de vehículo',
          type: 'buscador',
          required: true,
          options: tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre })),
          emptyLabel: 'tipo de vehículo',
        },
      ],
    },
    {
      title: 'Medidas',
      fields: [
        {
          key: 'anchoMm',
          label: 'Ancho de banda (mm)',
          type: 'number',
          required: true,
          placeholder: '220',
          validar: (v) => (Number(v) < 100 || Number(v) > 400 ? 'El ancho de banda va entre 100 y 400 mm' : ''),
        },
        {
          key: 'profundidadMm',
          label: 'Profundidad (mm)',
          required: true,
          placeholder: '16.5',
          validar: (v) => {
            const n = Number(String(v).trim().replace(',', '.'));
            return PROFUNDIDAD.test(String(v).trim()) && n > 0 && n <= 30
              ? ''
              : 'Escribe la profundidad en milímetros, con un decimal como máximo (16.5)';
          },
        },
        {
          key: 'medidasTexto',
          label: 'Medidas de llanta compatibles',
          type: 'etiquetas',
          mayusculas: true,
          required: true,
          span: 2,
          options: medidas,
          placeholder: 'Escribe una medida y pulsa Enter, por ejemplo 295/80R22.5',
          hint: 'El cliente encuentra la banda por la medida de su llanta. En la revisión solo se asigna a llantas de estas medidas.',
        },
      ],
    },
    {
      title: 'Precio',
      fields: [
        {
          key: 'precio',
          label: 'Precio de venta de la banda',
          type: 'money',
          required: true,
          placeholder: '470.000',
          hint: 'Solo lo ve el personal: es el valor que se sugiere en la revisión.',
        },
        { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] },
      ],
    },
  ];
}

/**
 * Catálogo de bandas. La banda es el producto del reencauche, pero no se
 * vende sola: el cliente la elige al pedir el reencauche y el asesor la
 * confirma (o la cambia) en la revisión de cada llanta.
 */
export default function BandasPage() {
  const bandas = useRecurso(bandasService);
  const tipos = useRecurso(tiposVehiculoService);
  // Medidas que ya existen en el catálogo de llantas, como sugerencia
  const [medidasConocidas, setMedidasConocidas] = useState([]);

  useEffect(() => {
    let vigente = true;
    productosService
      .medidas()
      .then((lista) => vigente && setMedidasConocidas(lista.map((m) => m.medida ?? m)))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  const medidas = useMemo(
    () => [...new Set([...medidasConocidas, ...bandas.filas.flatMap((b) => b.medidas)])].sort(),
    [medidasConocidas, bandas.filas],
  );
  const formSections = secciones({ tipos: tipos.filas, medidas });

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Reencauche', 'Bandas']} />
      <DataTable
        title="Bandas"
        columns={columns}
        data={bandas.filas}
        cargando={bandas.cargando}
        error={bandas.error}
        onRecargar={bandas.recargar}
        onCreate={bandas.crear}
        onEdit={bandas.editar}
        onDelete={bandas.eliminar}
        onStatusChange={(fila, estado) => bandas.ejecutar(() => bandasService.cambiarEstado(fila, estado))}
        statusKey="estado"
        statusVariant="switch"
        statusOptions={estadosActivo}
        newLabel="Nueva banda"
        entityName="banda"
        formSections={formSections}
        exportable={false}
        filters={[
          { key: 'diseno', label: 'Diseño', options: disenosBanda.map((d) => d.nombre) },
          { key: 'tipoVehiculo', label: 'Vehículo' },
          { key: 'estado', label: 'Estado', options: estadosActivo },
        ]}
      />
    </div>
  );
}
