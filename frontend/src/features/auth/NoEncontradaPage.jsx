import { ArrowLeft, Home, MapPinOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PantallaEstado, { BOTON_PRINCIPAL, BOTON_SECUNDARIO } from '../../components/base/PantallaEstado';

/**
 * Página no encontrada (404): la dirección no existe.
 *
 * `compacta` la muestra dentro del panel o del portal (el menú sigue a la
 * vista); `inicio` es a dónde lleva "Ir al inicio".
 */
export default function NoEncontradaPage({ compacta = false, inicio = '/' }) {
  const navigate = useNavigate();
  return (
    <PantallaEstado
      compacta={compacta}
      icono={MapPinOff}
      tono="ambar"
      codigo="404"
      titulo="Página no encontrada"
      mensaje="La dirección que abriste no existe o cambió. Revisa el enlace o vuelve a una sección conocida."
    >
      <button type="button" onClick={() => navigate(-1)} className={BOTON_SECUNDARIO}>
        <ArrowLeft size={16} /> Volver
      </button>
      <Link to={inicio} className={BOTON_PRINCIPAL}>
        <Home size={16} /> Ir al inicio
      </Link>
    </PantallaEstado>
  );
}
