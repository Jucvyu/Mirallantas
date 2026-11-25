import { useMemo } from 'react';
import { CalendarClock, CalendarDays, ClipboardCheck, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../../components/base/Badge';
import BotonAccion from '../../../components/base/BotonAccion';
import DataTable from '../../../components/base/DataTable';
import PageHeader from '../../../components/base/PageHeader';
import { estadosReencauche } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { bandasService, clientesService, reencauchesService } from '../../../services';
import { hoyISO } from '../../../utils/formato';
import { fechaCorta, llantasTexto, TONO_SOLICITUD } from '../reencauche';
import SolicitudReencaucheModal from '../SolicitudReencaucheModal';

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
    // Una línea por banda pedida (una solicitud puede traer varias)
    render: (s) => (
      <div className="space-y-0.5">
        {s.items.map((i) => (
          <div key={`${i.bandaId}-${i.medida}`}>
            <p>{i.banda}</p>
            <Segunda>
              {llantasTexto(i.cantidad)} · {i.medida}
            </Segunda>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: 'celdaRevision',
    label: 'Revisión',
    render: (s) => (
      <div>
        <p>{s.lugar === 'Local' ? 'En el local' : 'Donde el cliente'}</p>
        <Segunda>
          {s.estado === 'Por confirmar'
            ? `Propuesta ${fechaCorta(s.fechaRevision)} · pidió ${fechaCorta(s.fechaPreferida)}`
            : s.fechaRevision
              ? fechaCorta(s.fechaRevision)
              : `Prefiere ${fechaCorta(s.fechaPreferida)}`}
        </Segunda>
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
  'Por confirmar': { icono: CalendarClock, etiqueta: 'Esperando que el cliente confirme la fecha', tono: 'acento' },
};

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
          <SolicitudReencaucheModal
            titulo="Nueva solicitud de reencauche"
            subtitulo="Para un cliente que llega al local o llama. Puede traer varias bandas. La revisión es gratis."
            clientes={clientes.filas}
            bandas={bandas.filas}
            fechaMinima={hoyISO()}
            onEnviar={async (valores) => {
              const creada = await reencauchesService.crear(valores);
              navigate(`/admin/reencauches/${encodeURIComponent(creada.numero)}`);
            }}
            onClose={onClose}
          />
        )}
        newLabel="Nueva solicitud"
        entityName="solicitud"
        exportable={false}
        canView={false}
        canEdit={false}
        canDelete={false}
        // Amarillo: fecha propuesta que espera al cliente; ámbar suave: lo que falta hacer
        rowClassName={(s) =>
          s.estado === 'Por confirmar' ? 'bg-yellow-300/20 dark:bg-yellow-400/10' : ACCION[s.estado] ? 'bg-amber-400/[0.06]' : ''
        }
        rowActions={(s) => {
          const accion = ACCION[s.estado] ?? { icono: Eye, etiqueta: 'Ver la solicitud', tono: 'neutro' };
          return <BotonAccion icono={accion.icono} etiqueta={accion.etiqueta} tono={accion.tono} onClick={() => abrir(s)} />;
        }}
        filters={[{ key: 'estado', label: 'Estado', options: estadosReencauche }]}
      />
    </div>
  );
}
