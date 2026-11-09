import { useMemo, useState } from 'react';
import Badge from '../../../components/base/Badge';
import DataTable from '../../../components/base/DataTable';
import { columnaCliente } from '../../../components/base/celdaCliente';
import FormModal from '../../../components/base/FormModal';
import PageHeader from '../../../components/base/PageHeader';
import { estadosServicio } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { opcionesClientes, opcionesEmpresas } from '../../../utils/opciones';
import { clientesSeleccionablesService, solicitudesServicioService, tercerosService } from '../../../services';
import { formatCOP, parseCOP } from '../../../utils/formato';
import DetallePagoServicioModal from './DetallePagoServicioModal';
import TarjetaSolicitudServicio from './TarjetaSolicitudServicio';
import { TONO_PAGO } from './tonosPago';

// Solicitudes de reencauche. Nacen solas cuando una cotización incluye
// servicios (una por cada servicio), o las registra el asesor aquí.
//
// La tabla muestra UNA fila por cotización: si la cotización trae varios
// servicios, al desplegar la fila aparecen sus solicitudes en tarjetas. En
// cada tarjeta el asesor asigna el valor (el cliente recibe el aviso para
// pagarlo), revisa el pago y avanza el estado del reencauche, que solo sale
// de "Pendiente" con el pago aprobado.

/**
 * Resumen de varios estados en uno, por orden de urgencia: lo que necesita
 * atención primero (p. ej. un pago "En revisión" pesa más que uno aprobado).
 */
const resumir = (valores, prioridad) => prioridad.find((p) => valores.includes(p)) ?? valores[0];
const PRIORIDAD_PAGO = ['En revisión', 'Rechazado', 'Por pagar', 'Sin precio', 'Aprobado'];
const PRIORIDAD_ESTADO = ['Pendiente', 'En proceso', 'Completado', 'Cancelado'];

/** Agrupa las solicitudes por cotización (las sueltas quedan solas). */
function agrupar(solicitudes) {
  const grupos = new Map();
  for (const s of solicitudes) {
    const clave = s.cotizacion || s.id;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(s);
  }
  return [...grupos.entries()].map(([clave, lista]) => {
    const conPrecio = lista.filter((s) => s.precio);
    return {
      id: clave,
      cliente: lista[0].cliente,
      fecha: lista[0].fecha,
      solicitudes: lista,
      cantidadSolicitudes: lista.length,
      llantas: lista.reduce((suma, s) => suma + Number(s.cantidad), 0),
      valor:
        conPrecio.length === lista.length
          ? formatCOP(lista.reduce((suma, s) => suma + parseCOP(s.precio), 0))
          : conPrecio.length
            ? 'Parcial'
            : 'Sin asignar',
      pagoEstado: resumir(
        lista.map((s) => s.pagoEstado),
        PRIORIDAD_PAGO,
      ),
      estado: resumir(
        lista.map((s) => s.estado),
        PRIORIDAD_ESTADO,
      ),
      // Para que el buscador de la tabla también encuentre los SOL-…
      numeros: lista.map((s) => s.id).join(' '),
    };
  });
}

const columns = [
  { key: 'id', label: 'Cotización / Solicitud' },
  columnaCliente(),
  { key: 'cantidadSolicitudes', label: 'Servicios', render: (g) => `${g.cantidadSolicitudes} · ${g.llantas} llantas` },
  { key: 'valor', label: 'Valor' },
  { key: 'pagoEstado', label: 'Pago', render: (g) => <Badge tone={TONO_PAGO[g.pagoEstado]}>{g.pagoEstado}</Badge> },
  { key: 'estado', label: 'Reencauche', render: (g) => <Badge>{g.estado}</Badge> },
];

function seccionesFormulario({ clientes, terceros }) {
  return [
    {
      title: 'Origen de la solicitud',
      fields: [
        // El cliente se elige al crear; después no cambia
        // Buscador por nombre o documento: guarda el id real del cliente
        { key: 'clienteId', label: 'Cliente', type: 'buscador', required: true, options: opcionesClientes(clientes), placeholderBusqueda: 'Nombre o número de documento', emptyLabel: 'cliente', only: 'create' },
        { key: 'cliente', label: 'Cliente', only: ['edit', 'view'], soloLectura: true },
        // Al crear solo se pide la solicitud: lo demás se define en la revisión de la carcasa
        {
          key: 'terceroId',
          label: 'Reencauchadora',
          type: 'buscador',
          // Una reencauchadora inactiva no puede recibir solicitudes nuevas
          options: opcionesEmpresas(terceros),
          placeholderBusqueda: 'Razón social o NIT',
          emptyLabel: 'tercero',
          hint: 'Se asigna cuando la carcasa pasa la revisión.',
          only: 'edit',
        },
        { key: 'fecha', label: 'Fecha de recepción', type: 'date', only: 'edit' },
      ],
    },
    {
      title: 'Llanta a reencauchar',
      fields: [
        { key: 'cantidad', label: 'Cantidad de llantas', type: 'number', required: true, placeholder: '4' },
        { key: 'medidas', label: 'Medidas', placeholder: '295/80R22.5' },
        { key: 'descripcion', label: 'Descripción de la carcasa', type: 'textarea', span: 2, required: true },
        { key: 'foto', label: 'Foto de la carcasa', type: 'image', span: 2, placeholder: 'Sube la foto de la llanta usada' },
      ],
    },
    {
      title: 'Condiciones',
      fields: [
        // Se cambia con "Revisar la carcasa" (lleva su observación); nace pendiente de revisión
        { key: 'estadoEvidencia', label: 'Estado de la evidencia', only: 'edit', soloLectura: true },
        { key: 'tiempoEstimado', label: 'Tiempo estimado', placeholder: '9 días', only: 'edit' },
        // Sí / No: se resuelve mejor con un interruptor que con un desplegable
        { key: 'garantia', label: '¿Incluye garantía?', type: 'switch', only: 'edit' },
      ],
    },
  ];
}

export default function SolicitudesServicioPage() {
  const clientes = useRecurso(clientesSeleccionablesService);
  const terceros = useRecurso(tercerosService);
  const solicitudes = useRecurso(solicitudesServicioService);
  // Solicitud abierta en "Ver pago" y en "Editar"
  const [pagoDe, setPagoDe] = useState(null);
  const [editando, setEditando] = useState(null);

  // El servicio usa estas listas para enviar los nombres elegidos como ids
  const contexto = { clientes: clientes.filas, terceros: terceros.filas };
  const secciones = seccionesFormulario({ clientes: clientes.filas, terceros: terceros.filas });
  const grupos = useMemo(() => agrupar(solicitudes.filas), [solicitudes.filas]);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Reencauche', 'Servicios anteriores']} />
      <p className="mb-4 max-w-prose text-sm text-slate-500 dark:text-slate-400">
        Servicios pedidos con el flujo anterior (foto de la carcasa dentro de la cotización). Aquí solo se terminan los que
        quedaron a medias; los reencauches nuevos van en Revisiones.
      </p>
      <DataTable
        title="Servicios anteriores"
        columns={columns}
        data={grupos}
        cargando={solicitudes.cargando}
        error={solicitudes.error}
        onRecargar={solicitudes.recargar}
        formSections={secciones}
        entityName="solicitud"
        titleKey="cliente"
        // Cada solicitud se edita en su tarjeta, no en la fila del grupo
        canView={false}
        canEdit={false}
        canDelete={false}
        // Un pago por revisar resalta la fila en amarillo
        rowClassName={(g) => (g.pagoEstado === 'En revisión' ? 'bg-amber-400/10' : '')}
        filters={[
          { key: 'estado', label: 'Reencauche', options: estadosServicio },
          { key: 'pagoEstado', label: 'Pago', options: Object.keys(TONO_PAGO) },
        ]}
        expandir={(g) => (
          <div className="grid gap-3 lg:grid-cols-2">
            {g.solicitudes.map((s) => (
              <TarjetaSolicitudServicio
                key={s.id}
                solicitud={s}
                onPrecio={(valores) => solicitudes.ejecutar(() => solicitudesServicioService.asignarPrecio(s, valores))}
                onRevisar={(valores) => solicitudes.ejecutar(() => solicitudesServicioService.revisarCarcasa(s, valores))}
                onEstado={(estado, motivo) => solicitudes.ejecutar(() => solicitudesServicioService.cambiarEstado(s, estado, motivo))}
                onVerPago={() => setPagoDe(s)}
                onEditar={() => setEditando(s)}
                onEliminar={() => solicitudes.eliminar(s)}
              />
            ))}
          </div>
        )}
      />

      {editando && (
        <FormModal
          mode="edit"
          title={`Editar ${editando.id}`}
          subtitle="Reencauchadora, carcasa, tiempo y garantía. El valor se asigna en la tarjeta."
          sections={secciones}
          initialValues={editando}
          submitLabel="Guardar cambios"
          onSubmit={(valores) => solicitudes.editar(editando, valores, contexto)}
          onClose={() => setEditando(null)}
        />
      )}

      {pagoDe && (
        <DetallePagoServicioModal
          solicitud={pagoDe}
          onResuelto={solicitudes.recargar}
          onClose={() => setPagoDe(null)}
        />
      )}
    </div>
  );
}
