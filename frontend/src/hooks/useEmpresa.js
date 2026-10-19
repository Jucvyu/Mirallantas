import { useEffect, useState } from 'react';
import { empresaService } from '../services';

/**
 * Datos de la empresa para los comprobantes.
 *
 * `empresa` es null mientras carga o si un administrador todavía no los
 * ha registrado en Configuración › Empresa. Los comprobantes muestran un
 * aviso en ese caso, en vez de inventar un NIT o una dirección.
 */
export function useEmpresa() {
  const [empresa, setEmpresa] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    empresaService
      .obtener()
      .then((datos) => vigente && setEmpresa(datos))
      .catch(() => vigente && setEmpresa(null))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  return { empresa, cargando };
}
