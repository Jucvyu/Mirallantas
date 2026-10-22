import { z } from 'zod';
import { ESTADOS_EVIDENCIA, estadosDe } from '../reglas.js';
import {
  cantidad,
  fecha,
  idRelacion,
  imagen,
  listadoCon,
  medioPago,
  objetoEstricto,
  pesosPositivos,
  texto,
  textoOpcional,
} from './comunes.validator.js';

/** GET /solicitudes-servicio */
export const esquemaListado = listadoCon(['estado', 'estadoEvidencia', 'pagoEstado']);

// Campos que el asesor puede llenar al crear o editar
const campos = {
  terceroId: idRelacion.nullable().optional(),
  fecha: fecha.optional(),
  medidas: textoOpcional(30),
  descripcion: texto(500),
  foto: imagen.nullable().optional(),
  estadoEvidencia: z.enum(ESTADOS_EVIDENCIA).optional(),
  tiempoEstimado: textoOpcional(40),
  garantia: z.boolean().optional(),
  cantidad: cantidad(),
};

/** POST /solicitudes-servicio */
// El servicio es opcional: si no llega, es "Reencauche" (el único que se ofrece)
export const esquemaNueva = z.object({ clienteId: idRelacion, servicioId: idRelacion.optional(), ...campos });

/** PATCH /solicitudes-servicio/:numero — todo opcional, y además el estado. */
export const esquemaCambio = objetoEstricto(
  {
    servicioId: idRelacion,
    ...campos,
    estado: z.enum(estadosDe('servicio')),
    // Valor total del servicio que asigna el asesor (todas las llantas)
    precio: pesosPositivos('El valor del servicio debe ser mayor que cero.'),
    // Lo que cobra el tercero por el servicio (precio de compra; dato interno)
    costo: pesosPositivos('El precio de compra debe ser mayor que cero.'),
  },
  'Este campo no se puede modificar en la solicitud.',
).partial();

/** POST /solicitudes-servicio/:numero/pago — el asesor aprueba o rechaza el pago. */
export const esquemaRevisionPago = z.object({
  estado: z.enum(['Aprobado', 'Rechazado'], { error: 'Indica si apruebas o rechazas el pago.' }),
  motivo: textoOpcional(300),
});

/** POST /portal/servicios/:numero/pago — el cliente paga su servicio. */
export const esquemaPagoServicio = z.object({
  medioPago,
  comprobante: imagen.optional(),
});
