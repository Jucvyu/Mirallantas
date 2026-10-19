// =========================================================================
// Servicio de los datos de la empresa (encabezan los comprobantes).
// =========================================================================

import { api } from './http';

export const empresaService = {
  /** Datos de la empresa, o null si aún no se han registrado en la base. */
  async obtener() {
    const { datos } = await api('/empresa');
    return datos;
  },

};
