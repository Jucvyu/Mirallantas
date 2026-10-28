import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { permisoDeRuta } from '../permisos';

/**
 * ¿El rol puede hacer esa acción en el módulo de la pantalla actual? (nivel 3)
 *
 *   const puede = usePrivilegio();
 *   puede('anular')  // false si el rol tiene "anular" negado en este módulo
 *
 * Fuera de un módulo con permiso (p. ej. el portal) siempre es true: ahí
 * manda la API.
 */
export function usePrivilegio() {
  const { pathname } = useLocation();
  const { puede } = useAuth();
  const modulo = permisoDeRuta(pathname);
  return (accion) => !modulo || !accion || puede(modulo, accion);
}
