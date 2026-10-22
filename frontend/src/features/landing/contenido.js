import { WHATSAPP_EMPRESA } from '../../config';

/** Secciones del landing, en orden: alimentan el menú y las anclas. */
export const SECCIONES = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'productos', label: 'Productos' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'nosotros', label: 'Nosotros' },
  { id: 'contacto', label: 'Contacto' },
];

/** Enlace de WhatsApp de la empresa con un mensaje ya escrito. */
export function enlaceWhatsapp(mensaje = 'Hola, quiero solicitar una cotización de llantas.') {
  return `https://wa.me/${WHATSAPP_EMPRESA}?text=${encodeURIComponent(mensaje)}`;
}
