import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { avisosPersonalService } from '../services';
import { useAlCambiar } from './useAlCambiar';

/** Cada cuánto se revisa si llegaron avisos nuevos (igual que la campana). */
const CADA_MS = 60_000;

/**
 * Avisos nuevos de cada módulo, para las burbujas del menú: en el panel
 * { '/admin/abonos': 2, … } y, con `notificacionesService`, en el portal
 * del cliente { '/portal/pedidos': 1, … }.
 *
 * Revisa al montar, cada minuto y al cambiar de pantalla. Al entrar a un
 * módulo con avisos, su burbuja desaparece y la API lo recuerda.
 */
export function useAvisosPorModulo(servicio = avisosPersonalService) {
  const [porRuta, setPorRuta] = useState({});
  const { pathname } = useLocation();
  // Sube cuando la API avisa un cambio (tiempo real): se revisa enseguida
  const [aviso, setAviso] = useState(0);
  useAlCambiar(() => setAviso((n) => n + 1));

  useEffect(() => {
    let vigente = true;
    const revisar = () =>
      servicio
        .porModulo()
        .then((datos) => vigente && setPorRuta(datos))
        .catch(() => {}); // Sin conexión: se vuelve a intentar en el siguiente minuto
    revisar();
    const id = setInterval(revisar, CADA_MS);
    return () => {
      vigente = false;
      clearInterval(id);
    };
  }, [servicio, pathname, aviso]);

  // Se entró a un módulo con avisos: se marcan como vistos
  useEffect(() => {
    if (!porRuta[pathname]) return;
    servicio
      .marcarVista(pathname)
      .then(() => setPorRuta((actual) => ({ ...actual, [pathname]: 0 })))
      .catch(() => {});
  }, [servicio, pathname, porRuta]);

  return porRuta;
}
