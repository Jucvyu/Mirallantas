import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controlador from '../controllers/auth.controller.js';
import * as recuperacion from '../controllers/recuperacion.controller.js';
import { config } from '../config.js';
import { autenticar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import {
  esquemaActivar2fa,
  esquemaCambiarRecuperacion,
  esquemaCaptcha,
  esquemaDesactivar2fa,
  esquemaGoogle,
  esquemaLogin,
  esquemaPerfil,
  esquemaRegistro,
  esquemaSolicitarRecuperacion,
  esquemaVerificar2fa,
  esquemaVerificarRecuperacion,
} from '../validators/auth.validator.js';

/**
 * Rutas de sesión (/api/auth).
 *
 *   POST /login             contraseña → token, o desafío si tiene doble factor
 *   POST /google            token de Google → igual que /login (solo cuentas existentes)
 *   POST /2fa/verificar     desafío + código de 6 dígitos → token
 *   POST /registro          crea una cuenta de cliente desde el login (pública)
 *   POST /captcha           solo comprueba el captcha (página de inicio → WhatsApp)
 *   POST /salir             cierra la sesión (invalida el token)
 *   GET  /yo                datos del usuario en sesión
 *   PUT  /yo                el usuario actualiza su propio perfil
 *   POST /2fa/configurar    genera el QR del doble factor
 *   POST /2fa/activar       activa el doble factor con un código
 *   POST /2fa/desactivar    lo desactiva (contraseña + código)
 *
 *   ¿Olvidaste tu contraseña? (públicas)
 *   GET  /recuperar/estado      intentos que le quedan a esta IP
 *   POST /recuperar/solicitar   correo → envía un código de 6 dígitos
 *   POST /recuperar/verificar   código → lo marca como verificado
 *   POST /recuperar/cambiar     contraseña nueva
 */
export const rutasAuth = Router();

// Frena ataques de fuerza bruta: 10 intentos FALLIDOS por IP cada 15
// minutos. Los inicios de sesión correctos no gastan intentos
// (skipSuccessfulRequests: solo cuentan las respuestas con error). Además,
// cada cuenta se bloquea 15 minutos tras 5 fallos seguidos (controlador), y
// un inicio correcto reinicia ese contador.
const limiteIntentos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
  // Las pruebas automáticas inician sesión muchas veces seguidas
  skip: () => config.esPrueba,
});

// Acciones sensibles con la sesión ya iniciada
const limiteSensible = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
  // Las pruebas automáticas inician sesión muchas veces seguidas
  skip: () => config.esPrueba,
});

rutasAuth.post('/login', limiteIntentos, validar(esquemaLogin), controlador.iniciarSesion);
rutasAuth.post('/google', limiteIntentos, validar(esquemaGoogle), controlador.iniciarConGoogle);
rutasAuth.post('/2fa/verificar', limiteIntentos, validar(esquemaVerificar2fa), controlador.verificarDobleFactor);
rutasAuth.post('/registro', limiteIntentos, validar(esquemaRegistro), controlador.registrarse);

rutasAuth.post('/salir', autenticar, controlador.cerrarSesion);
rutasAuth.get('/yo', autenticar, controlador.verPerfil);
rutasAuth.put('/yo', autenticar, limiteSensible, validar(esquemaPerfil), controlador.actualizarPerfil);
rutasAuth.post('/2fa/configurar', autenticar, limiteSensible, controlador.configurarDobleFactor);
rutasAuth.post('/2fa/activar', autenticar, limiteSensible, validar(esquemaActivar2fa), controlador.activarDobleFactor);
rutasAuth.post('/2fa/desactivar', autenticar, limiteSensible, validar(esquemaDesactivar2fa), controlador.desactivarDobleFactor);

// Las reglas de intentos (5 correos, 3 códigos, 2 minutos de espera) están en
// el controlador; este límite general frena el abuso por volumen.
const limiteRecuperacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
  skip: () => config.esPrueba,
});

rutasAuth.get('/recuperar/estado', recuperacion.estado);
// Solo el captcha: lo usa "Solicitar cotización" de la página de inicio
rutasAuth.post('/captcha', limiteIntentos, validar(esquemaCaptcha), controlador.verificarCaptcha);

rutasAuth.post('/recuperar/solicitar', limiteRecuperacion, validar(esquemaSolicitarRecuperacion), recuperacion.solicitar);
rutasAuth.post('/recuperar/verificar', limiteRecuperacion, validar(esquemaVerificarRecuperacion), recuperacion.verificar);
rutasAuth.post('/recuperar/cambiar', limiteRecuperacion, validar(esquemaCambiarRecuperacion), recuperacion.cambiar);
