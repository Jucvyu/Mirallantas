/**
 * Correo con el código para recuperar la contraseña.
 *
 * El HTML usa tablas y estilos en línea: es lo único que respetan Gmail,
 * Outlook y los clientes de celular. Siempre va también la versión en texto
 * plano (algunos clientes solo muestran esa).
 */

/** Quita lo que podría convertirse en HTML dentro del nombre. */
const limpiar = (texto) => String(texto).replace(/[<>&"']/g, '');

/** "123456" → "123 456" (más fácil de leer y de copiar en dos partes). */
const separar = (codigo) => `${codigo.slice(0, 3)} ${codigo.slice(3)}`;

/** { asunto, texto, html } listos para enviarCorreo(). */
export function plantillaRecuperacion({ nombre, codigo, minutos }) {
  const primerNombre = limpiar(nombre).trim().split(/\s+/)[0] || 'hola';
  const asunto = `${codigo} es tu código de MiraLlantas`;

  const texto =
    `Hola, ${primerNombre}.\n\n` +
    `Tu código para recuperar la contraseña es: ${codigo}\n\n` +
    `Escríbelo en la ventana de "¿Olvidaste tu contraseña?". Vence en ${minutos} minutos y solo sirve una vez.\n\n` +
    'Si no fuiste tú, ignora este correo: tu contraseña sigue igual. Nunca compartas este código; ' +
    'en MiraLlantas nadie te lo va a pedir.\n\n' +
    '— MiraLlantas · Venta de llantas y reencauche';

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${asunto}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;">
<!-- Vista previa en la bandeja de entrada -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu código vence en ${minutos} minutos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E3E5E9;">

        <!-- Encabezado con la marca -->
        <tr>
          <td style="background:#12161C;padding:22px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:38px;height:38px;background:#FBBF24;border-radius:10px;text-align:center;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#12161C;">ML</td>
                <td style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#FFFFFF;">MiraLlantas <span style="color:#FBBF24;">ERP</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:4px;background:#FBBF24;line-height:4px;font-size:0;">&nbsp;</td></tr>

        <!-- Mensaje -->
        <tr>
          <td style="padding:32px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#1B2230;">
            <p style="margin:0 0 6px;font-size:22px;font-weight:bold;">Hola, ${primerNombre}</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#4B5563;">
              Recibimos una solicitud para recuperar la contraseña de tu cuenta.
              Escribe este código en la ventana de <strong>“¿Olvidaste tu contraseña?”</strong>:
            </p>
          </td>
        </tr>

        <!-- Código -->
        <tr>
          <td align="center" style="padding:24px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#FFFBEB;border:2px dashed #FBBF24;border-radius:12px;">
              <tr>
                <td style="padding:18px 30px;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:bold;letter-spacing:8px;color:#12161C;text-align:center;">${separar(codigo)}</td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6B7280;">
              Vence en <strong style="color:#B45309;">${minutos} minutos</strong> y solo sirve una vez.
            </p>
          </td>
        </tr>

        <!-- Aviso de seguridad -->
        <tr>
          <td style="padding:8px 28px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#4B5563;">
                  <strong style="color:#1B2230;">¿No fuiste tú?</strong> Ignora este correo: tu contraseña sigue igual.
                  Nunca compartas este código; en MiraLlantas nadie te lo va a pedir.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="border-top:1px solid #E3E5E9;padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9CA3AF;text-align:center;">
            MiraLlantas · Venta de llantas y reencauche<br>
            Este es un correo automático, por favor no lo respondas.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { asunto, texto, html };
}
