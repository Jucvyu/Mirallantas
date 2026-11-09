import { useMemo } from 'react';
import { CalendarDays, ClipboardCheck, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../../components/base/Badge';
import BotonAccion from '../../../components/base/BotonAccion';
import DataTable from '../../../components/base/DataTable';
import FormModal from '../../../components/base/FormModal';
import PageHeader from '../../../components/base/PageHeader';
import { estadosReencauche, LLANTAS_POR_REENCAUCHE } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { bandasService, clientesService, reencauchesService } from '../../../services';
import { LUGAR_CLIENTE, LUGAR_LOCAL } from '../../../services/reencauche.service';
import { hoyISO } from '../../../utils/formato';
import { opcionesClientes } from '../../../utils/opciones';
import { fechaCorta, llantasTexto, TONO_SOLICITUD } from '../reencauche';

const Segunda = ({ children }) => <p className="text-xs text-slate-400 dark:text-slate-500">{children}</p>;

// Claves propias de cada celda (no las del dato): así la tabla deja bajar de
// línea el texto secundario. Cinco columnas: caben sin desplazarse de lado desde 1024 px; en pantallas
// más pequeñas la tabla muestra una tarjeta por fila
const columns = [
  {
    key: 'celdaSolicitud',
    label: 'Solicitud',
    render: (s) => (
      <div>
        <p className="whitespace-nowrap font-semibold text-slate-800 dark:text-slate-100">{s.numero}</p>
        <Segunda>{s.cliente}</Segunda>
      </div>
    ),
  },
  {
    key: 'celdaPedido',
    label: 'Pedido',
    render: (s) => (
      <div>
        <p>{s.banda}</p>
        <Segunda>
          {llantasTexto(s.cantidad)} · {s.medida}
        </Segunda>
      </div>
    ),
  },
  {
    key: 'celdaRevision',
    label: 'Revisión',
    render: (s) => (
      <div>
        <p>{s.lugar === 'Local' ? 'En el local' : 'Donde el cliente'}</p>
        <Segunda>{s.fechaRevision ? fechaCorta(s.fechaRevision) : `Prefiere ${fechaCorta(s.fechaPreferida)}`}</Segunda>
      </div>
    ),
  },
  {
    key: 'celdaEstado',
    label: 'Estado',
    render: (s) => (
      <div>
        <Badge tone={TONO_SOLICITUD[s.estado]}>{s.estado}</Badge>
        {s.estado === 'Aceptada' && (
          <p className="mt-1 text-xs text-slate-400">
            {s.entregadas} de {s.aptas - s.rechazadasPlanta} entregadas
          </p>
        )}
      </div>
    ),
  },
  {
    key: 'celdaValor',
    label: 'Valor',
    render: (s) => <span className="tabular-nums">{s.revisadas ? s.valorTexto : '—'}</span>,
  },
];

/** Acción principal de cada fila según lo que falta hacer. */
const ACCION = {
  'Por agendar': { icono: CalendarDays, etiqueta: 'Agendar la revisión', tono: 'destacado' },
  Agendada: { icono: ClipboardCheck, etiqueta: 'Registrar la revisión', tono: 'destacado' },
};

/** Formulario para registrar la solicitud de un cliente que llega al local o llama. */
function NuevaSolicitudModal({ clientes, bandas, onCreada, onClose }) {
  const activas = bandas.filter((b) => b.activo);
  const bandaDe = (id) => activas.find((b) => b.id === Number(id));
  const medidas = [...new Set(activas.flatMap((b) => b.medidas))].sort();

  const sections = [
    {
      title: 'Cliente y banda',
      fields: [
        {
          key: 'clienteId',
          label: 'Cliente',
          type: 'buscador',
          required: true,
          span: 2,
          options: opcionesClientes(clientes),
          placeholderBusqueda: 'Nombre o número de documento',
          emptyLabel: 'cliente',
        },
        {
          key: 'bandaId',
          label: 'Banda',
          type: 'buscador',
          required: true,
          span: 2,
          options: activas.map((b) => ({
            valor: b.id,
            etiqueta: b.nombre,
            detalle: `${b.diseno} · ${b.anchoMm} mm · ${b.tipoVehiculo}`,
          })),
          emptyLabel: 'banda',
        },
        {
          key: 'medida',
          label: 'Medida de las llantas',
          type: 'buscador',
          required: true,
          options: medidas,
          validar: (v, valores) => {
            const banda = bandaDe(valores.bandaId);
            return banda && !banda.medidas.includes(v) ? `${banda.nombre} no sirve para ${v}` : '';
          },
        },
        {
          key: 'cantidad',
          label: 'Cantidad de llantas',
          type: 'number',
          required: true,
          validar: (v) => (Number(v) < 1 || Number(v) > LLANTAS_POR_REENCAUCHE ? `Entre 1 y ${LLANTAS_POR_REENCAUCHE} llantas` : ''),
        },
      ],
    },
    {
      title: 'Revisión',
      fields: [
        { key: 'lugar', label: 'Dónde se revisan', type: 'select', required: true, options: [LUGAR_LOCAL, LUGAR_CLIENTE] },
        { key: 'fechaPreferida', label: 'Fecha que prefiere', type: 'date', futura: true, required: true },
        {
          key: 'direccion',
          label: 'Dirección del cliente',
          span: 2,
          placeholder: 'Solo si la revisión es donde el cliente',
          validar: (v, valores) => (valores.lugar === LUGAR_CLIENTE && !String(v ?? '').trim() ? 'Escribe la dirección' : ''),
        },
        { key: 'notas', label: 'Notas', type: 'textarea', span: 2, placeholder: 'Lo que contó el cliente de sus llantas' },
      ],
    },
  ];

  return (
    <FormModal
      mode="create"
      title="Nueva solicitud de reencauche"
      subtitle="Para un cliente que llega al local o llama. La revisión es gratis."
      sections={sections}
      initialValues={{ cantidad: '1', lugar: LUGAR_LOCAL, fechaPreferida: hoyISO() }}
      submitLabel="Registrar solicitud"
      onSubmit={async (valores) => onCreada(await reencauchesService.crear(valores))}
      onClose={onClose}
    />
  );
}

/**
 * Solicitudes de reencauche. Arriba quedan las que necesitan algo: por
 * agendar y por revisar. Cada fila lleva a su detalle, donde se agenda, se
 * registra la revisión de cada llanta y se ve la respuesta del cliente.
 */
export default function RevisionesPage() {
  const solicitudes = useRecurso(reencauchesService);
  const clientes = useRecurso(clientesService);
  const bandas = useRecurso(bandasService);
  const navigate = useNavigate();
  const abrir = (s) => navigate(`/admin/reencauches/${encodeURIComponent(s.numero)}`);

  const filas = useMemo(() => solicitudes.filas, [solicitudes.filas]);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Reencauche', 'Revisiones']} />
      <DataTable
        title="Revisiones"
        columns={columns}
        data={filas}
        cargando={solicitudes.cargando}
        error={solicitudes.error}
        onRecargar={solicitudes.recargar}
        // El botón "Nueva solicitud" abre un formulario propio
        onCreate={() => {}}
        createModal={({ onClose }) => (
          <NuevaSolicitudModal
            clientes={clientes.filas}
            bandas={bandas.filas}
            onCreada={(creada) => navigate(`/admin/reencauches/${encodeURIComponent(creada.numero)}`)}
            onClose={onClose}
          />
        )}
        newLabel="Nueva solicitud"
        entityName="solicitud"
        exportable={false}
        canView={false}
        canEdit={false}
        canDelete={false}
        rowClassName={(s) => (ACCION[s.estado] ? 'bg-amber-400/[0.06]' : '')}
        rowActions={(s) => {
          const accion = ACCION[s.estado] ?? { icono: Eye, etiqueta: 'Ver la solicitud', tono: 'neutro' };
          return <BotonAccion icono={accion.icono} etiqueta={accion.etiqueta} tono={accion.tono} onClick={() => abrir(s)} />;
        }}
        filters={[{ key: 'estado', label: 'Estado', options: estadosReencauche }]}
      />
    </div>
  );
}
