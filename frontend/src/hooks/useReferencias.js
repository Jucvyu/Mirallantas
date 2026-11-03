import { useSyncExternalStore } from 'react';
import { suscribirReferencias, versionReferencias } from '../services';

/** Redibuja el componente cuando llegan las listas del sistema (ver referencias.service.js). */
export function useReferencias() {
  return useSyncExternalStore(suscribirReferencias, versionReferencias);
}
