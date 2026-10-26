// =========================================================================
// Servicio de sesión: iniciar y cerrar sesión, registrarse y perfil.
//
// Guarda el token que entrega la API para que las demás peticiones vayan
// autenticadas (ver http.js).
// =========================================================================

import { imagenCambiada } from './adaptadores';
import { api, borrarToken, guardarToken, leerToken } from './http';

export const authService = {
  /** ¿Hay un token guardado de una sesión anterior? */
  haySesionGuardada() {
    return Boolean(leerToken());
  },

  /** Usuario de la sesión guardada (lanza error si el token ya no sirve). */
  async usuarioActual() {
    const { usuario } = await api('/auth/yo');
    return usuario;
  },

  /**
   * Primer paso del inicio de sesión. Devuelve:
   *   { usuario }                    si ya quedó la sesión iniciada, o
   *   { requiere2fa: true, desafio } si la cuenta pide el código de 6 dígitos.
   */
  async iniciarSesion(correo, password, captcha) {
    const respuesta = await api('/auth/login', { metodo: 'POST', cuerpo: { correo, password, captcha } });
    if (respuesta.requiere2fa) return { requiere2fa: true, desafio: respuesta.desafio };
    guardarToken(respuesta.token);
    return { usuario: respuesta.usuario };
  },

  /** Igual que iniciarSesion, con el token que entregó Google. */
  async iniciarConGoogle(credencial, captcha) {
    const respuesta = await api('/auth/google', { metodo: 'POST', cuerpo: { credencial, captcha } });
    if (respuesta.requiere2fa) return { requiere2fa: true, desafio: respuesta.desafio };
    guardarToken(respuesta.token);
    return { usuario: respuesta.usuario };
  },

  /** Segundo paso: el código de la app autenticadora. Devuelve el usuario. */
  async verificarCodigo(desafio, codigo) {
    const { token, usuario } = await api('/auth/2fa/verificar', { metodo: 'POST', cuerpo: { desafio, codigo } });
    guardarToken(token);
    return usuario;
  },

  /** Genera el QR del doble factor: { secreto, direccion }. */
  configurarDobleFactor() {
    return api('/auth/2fa/configurar', { metodo: 'POST' });
  },

  /** Activa el doble factor. La API cierra las demás sesiones y entrega un token nuevo. */
  async activarDobleFactor(codigo) {
    const { token, usuario } = await api('/auth/2fa/activar', { metodo: 'POST', cuerpo: { codigo } });
    guardarToken(token);
    return usuario;
  },

  /** Desactiva el doble factor (pide la contraseña y un código vigente). */
  async desactivarDobleFactor(passwordActual, codigo) {
    const { usuario } = await api('/auth/2fa/desactivar', { metodo: 'POST', cuerpo: { passwordActual, codigo } });
    return usuario;
  },

  /** Crea una cuenta de cliente (queda con la sesión iniciada). */
  async registrarse(valores) {
    const { token, usuario } = await api('/auth/registro', {
      metodo: 'POST',
      cuerpo: {
        nombre: valores.nombre,
        tipoDocumento: valores.tipoDocumento,
        numeroDocumento: valores.numeroDocumento,
        telefono: valores.telefono,
        direccion: valores.direccion || null,
        correo: valores.correo.trim().toLowerCase(),
        password: valores.password,
      },
    });
    guardarToken(token);
    return usuario;
  },

  /**
   * Guarda el perfil propio. La foto solo se envía si cambió y la
   * contraseña solo si se escribió una nueva. Cambiar la contraseña o el
   * correo pide la contraseña actual; en ese caso la API cierra las demás
   * sesiones y entrega un token nuevo. Devuelve el usuario actualizado.
   */
  async actualizarPerfil(valores, perfilActual) {
    const { token, usuario } = await api('/auth/yo', {
      metodo: 'PUT',
      cuerpo: {
        nombre: valores.nombre,
        tipoDocumento: valores.tipoDocumento,
        numeroDocumento: valores.numeroDocumento,
        correo: valores.correo,
        telefono: valores.telefono || null,
        // La dirección solo existe en las cuentas del portal
        ...(perfilActual.clienteId ? { direccion: valores.direccion || null } : {}),
        foto: imagenCambiada(valores.foto, perfilActual.foto),
        password: valores.password || undefined,
        passwordActual: valores.passwordActual || undefined,
      },
    });
    if (token) guardarToken(token);
    return usuario;
  },

  /**
   * Cierra la sesión: la API invalida el token (aunque alguien lo hubiera
   * copiado) y el navegador lo olvida. Si no hay conexión, igual se borra.
   */
  async cerrarSesion() {
    try {
      if (leerToken()) await api('/auth/salir', { metodo: 'POST' });
    } catch {
      // Sin conexión o token ya vencido: basta con olvidarlo
    } finally {
      borrarToken();
    }
  },

  // ---- ¿Olvidaste tu contraseña? ---------------------------------------------
  // Los intentos y el bloqueo de 2 minutos los lleva la API (por IP). Si la
  // API rechaza, el error trae `error.datos` con { intentosRestantes,
  // bloqueadoHasta, intentosCodigo } para mostrarlos en el modal.

  /** Intentos que le quedan a este equipo: { intentosRestantes, bloqueadoHasta }. */
  estadoRecuperacion() {
    return api('/auth/recuperar/estado');
  },

  /** Paso 1: busca el correo y envía el código. Devuelve { solicitud, correo, intentosCodigo }. */
  solicitarRecuperacion(correo) {
    return api('/auth/recuperar/solicitar', { metodo: 'POST', cuerpo: { correo: correo.trim().toLowerCase() } });
  },

  /** Paso 2: revisa el código de 6 dígitos. */
  verificarCodigoRecuperacion(solicitud, codigo) {
    return api('/auth/recuperar/verificar', { metodo: 'POST', cuerpo: { solicitud, codigo } });
  },

  /** Paso 3: guarda la contraseña nueva. */
  cambiarPasswordRecuperada(solicitud, password) {
    return api('/auth/recuperar/cambiar', { metodo: 'POST', cuerpo: { solicitud, password } });
  },

  /** Olvida el token sin avisar a la API (cuando la API ya lo rechazó). */
  olvidarSesion() {
    borrarToken();
  },
};
