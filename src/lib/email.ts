import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export interface SendEmailOptions {
  to: string;
  subject: string;
  fullName: string;
  accessIdentifier: string;
  tempPassword?: string;
  expiresAtFormatted: string;
  loginUrl: string;
  logoUrl?: string;
  nombreSistema?: string;
}

let sesClient: SESClient | null = null;

const getSESClient = () => {
  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return sesClient;
};

const getSenderEmail = () => process.env.AWS_SES_SENDER || "fhernandez@smarttestingrd.com";

const isValidPublicUrl = (url?: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  return (trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !trimmed.includes('/storage/logo');
};

/**
 * Sends reset password email via AWS SES using official Bikers' Fort email template.
 */
export async function sendResetPasswordEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, subject, fullName, accessIdentifier, tempPassword, expiresAtFormatted, loginUrl: providedLoginUrl } = options;

    if (!to || !to.trim()) {
      return { success: false, error: 'Dirección de correo electrónico requerida.' };
    }

    const recipient = to.trim();
    const sender = getSenderEmail();

    const rawLogoUrl = options.logoUrl || process.env.LOGO_URL || process.env.NEXT_PUBLIC_LOGO_URL || "";
    const logoUrl = isValidPublicUrl(rawLogoUrl) ? rawLogoUrl.trim() : "";

    const loginUrl = (providedLoginUrl || process.env.LOGIN_URL || process.env.FRONTEND_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000/login").trim();
    const currentYear = new Date().getFullYear();
    const textContent = `
Restablecimiento de contraseña

Hola, ${fullName || 'Usuario'}:

Un administrador ha restablecido la contraseña de su cuenta en Ride Lab.

Usuario de acceso: ${accessIdentifier}
Contraseña temporal: ${tempPassword || '***'}
Fecha de expiración: ${expiresAtFormatted || '7 días'}

Por seguridad, deberá cambiar esta contraseña la próxima vez que inicie sesión.
No comparta esta contraseña con ninguna persona.

Ingresar al sistema: ${loginUrl}

Si usted no solicitó este cambio, comuníquese con el administrador del sistema.

Este correo fue enviado automáticamente por Ride Lab.
Por favor, no responda a este mensaje.
© ${currentYear} Ride Lab. Todos los derechos reservados.
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${subject}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #F3F4F6; font-family: Arial, Helvetica, sans-serif; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding: 24px 18px !important; }
      .card-padding { padding: 16px !important; }
      .btn-responsive { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #F3F4F6; font-family: Arial, Helvetica, sans-serif; color: #1F2937; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F3F4F6;">
    <tr>
      <td align="center" style="padding: 0;">
        <!-- MAIN CONTAINER -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 620px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05); overflow: hidden; margin: 0 auto;">
          
          <!-- HEADER -->
          <tr>
            <td align="center" style="background-color: #111827; padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="Ride Lab" width="140" style="display: block; margin: 0 auto 12px auto; max-height: 50px; border: 0;" />` : ''}
              <div style="font-size: 22px; font-weight: 800; color: #D4E881; letter-spacing: 1.5px; text-transform: uppercase; font-family: Arial, Helvetica, sans-serif;">RIDE LAB</div>
              <div style="font-size: 11px; font-weight: 600; color: #9CA3AF; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; font-family: Arial, Helvetica, sans-serif;">Tienda y Taller de Bicicletas</div>
            </td>
          </tr>

          <!-- BODY CONTENT -->
          <tr>
            <td class="content-padding" style="padding: 32px; background-color: #FFFFFF;">
              <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif;">Restablecimiento de contraseña</h1>
              
              <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 12px 0; font-family: Arial, Helvetica, sans-serif;">
                Hola, <strong>${fullName || 'Usuario'}</strong>:
              </p>
              
              <p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif;">
                Un administrador ha restablecido la contraseña de su cuenta en Ride Lab.
              </p>

              <!-- CREDENTIALS CARD -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td class="card-padding" style="padding: 20px;">
                    <!-- Access User -->
                    <div style="font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; font-family: Arial, Helvetica, sans-serif;">Usuario de acceso</div>
                    <div style="font-size: 15px; font-weight: 600; color: #111827; word-break: break-all; margin-bottom: 16px; font-family: Arial, Helvetica, sans-serif;">${accessIdentifier || ''}</div>
                    
                    <!-- Temp Password -->
                    <div style="font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-family: Arial, Helvetica, sans-serif;">Contraseña temporal</div>
                    <div style="font-size: 16px; font-weight: 700; color: #047857; font-family: 'Courier New', Courier, monospace; background-color: #ECFDF5; border: 1px dashed #A7F3D0; padding: 10px 14px; border-radius: 6px; display: inline-block; letter-spacing: 1px; margin-bottom: 16px;">
                      ${tempPassword || '***'}
                    </div>

                    <!-- Expiration Info -->
                    <div style="font-size: 12px; color: #6B7280; line-height: 1.5; font-family: Arial, Helvetica, sans-serif;">
                      ⏰ Esta contraseña expirará en: <strong>${expiresAtFormatted || '7 días'}</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- SECURITY WARNING -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 4px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 14px 16px; font-size: 13px; color: #92400E; line-height: 1.5; font-family: Arial, Helvetica, sans-serif;">
                    🔒 <strong>Medida de seguridad obligatoria:</strong> Deberá cambiar esta contraseña temporal la primera vez que ingrese al sistema. Por favor, no la comparta con nadie.
                  </td>
                </tr>
              </table>

              <!-- CTA BUTTON -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${loginUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="18%" stroke="f" fillcolor="#D4E881">
                      <w:anchorlock/>
                      <center style="color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">Iniciar Sesión</center>
                    </v:roundrect>
                    <![endif]-->
                    <a href="${loginUrl}" target="_blank" class="btn-responsive" style="background-color: #D4E881; color: #111827; display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 700; line-height: 48px; text-align: center; text-decoration: none; padding: 0 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); -webkit-text-size-adjust: none; mso-hide: all;">
                      Iniciar Sesión en Ride Lab &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <div style="border-top: 1px solid #F3F4F6; padding-top: 16px; font-size: 12px; color: #6B7280; line-height: 1.5; text-align: center; font-family: Arial, Helvetica, sans-serif;">
                Si usted no solicitó este cambio, comuníquese con el administrador del sistema.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #F9FAFB; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px; padding: 20px; text-align: center; font-size: 12px; color: #6B7280; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">
              Este correo fue enviado automáticamente por Ride Lab.<br>
              Por favor, no responda a este mensaje.<br>
              <span style="font-size: 11px; color: #9CA3AF; margin-top: 6px; display: inline-block;">© ${currentYear} Ride Lab. Todos los derechos reservados.</span>
            </td>
          </tr>

        </table>
        <!-- END MAIN CONTAINER -->
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const command = new SendEmailCommand({
      Source: `Ride Lab <${sender}>`,
      Destination: {
        ToAddresses: [recipient],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlContent,
            Charset: "UTF-8",
          },
          Text: {
            Data: textContent,
            Charset: "UTF-8",
          },
        },
      },
    });

    const response = await getSESClient().send(command);
    console.log(`[AWS SES SUCCESS] Destinatario: ${recipient} | MessageId: ${response.MessageId}`);

    return {
      success: true,
      messageId: response.MessageId
    };
  } catch (error: any) {
    console.error('[AWS SES ERROR]', error);
    let errorMessage = error.message || 'Error al enviar el correo a través de AWS SES';
    if (error.name === 'EmailAddressNotVerifiedException' || errorMessage.includes('not verified')) {
      errorMessage = 'La dirección de correo electrónico del remitente o destinatario no está verificada en AWS SES.';
    }
    return {
      success: false,
      error: errorMessage
    };
  }
}

