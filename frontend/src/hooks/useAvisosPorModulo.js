import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { avisosPersonalService } from '../services';

/** Cada cuánto se revisa si llegaron avisos nuevos (igual que la campana). */
const CADA_MS = 60_000;

/**
 * Avisos nuevos de cada módulo del panel, para las burbujas del menú
 * lateral: { '/admin/abonos': 2, … }.
 *
 * Revisa al montar, cada minuto y al cambiar de pantalla. Al entrar a un
 * módulo con avisos, su burbuja desaparece y la API lo recuerda.
 */
export function useAvisosPorModulo() {
  const [porRuta, setPorRuta] = useState({});
  const { pathname } = useLocation();

  useEffect(() => {
    let vigente = true;
    const revisar = () =>
      avisosPersonalService
        .porModulo()
        .then((datos) => vigente && setPorRuta(datos))
        .catch(() => {}); // Sin conexión: se vuelve a intentar en el siguiente minuto
    revisar();
    const id = setInterval(revisar, CADA_MS);
    return () => {
      vigente = false;
      clearInterval(id);
    };
  }, [pathname]);

  // Se entró a un módulo con avisos: se marcan como vistos
  useEffect(() => {
    if (!porRuta[pathname]) return;
    avisosPersonalService
      .marcarVista(pathname)
      .then(() => setPorRuta((actual) => ({ ...actual, [pathname]: 0 })))
      .catch(() => {});
  }, [pathname, porRuta]);

  return porRuta;
}
