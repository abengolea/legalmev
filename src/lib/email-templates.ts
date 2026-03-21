/**
 * Plantillas HTML compartidas para emails de LegalMev.
 * Colores: #2A6A78 (primary), #54A6A8 (accent).
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
const BASE = SITE_URL.replace(/\/$/, '');

function emailWrapper(innerContent: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>LegalMev</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.6;color:#333;background-color:#f0f4f5;">
  <div style="min-height:100vh;padding:24px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;">
      <tr>
        <td>
          ${innerContent}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

function emailHeader(): string {
  return `
  <div style="text-align:center;padding:24px 0 32px;">
    <a href="${BASE}" style="text-decoration:none;color:inherit;">
      <span style="font-size:24px;font-weight:700;color:#2A6A78;letter-spacing:-0.02em;">LegalMev</span>
    </a>
    <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Exportá expedientes a PDF desde MEV y PJN</p>
  </div>`;
}

function emailCard(content: string): string {
  return `
  <div style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;">
    <div style="padding:32px 28px;">
      ${content}
    </div>
  </div>`;
}

function emailFooter(): string {
  return `
  <div style="text-align:center;padding:32px 16px 16px;">
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
      <a href="${BASE}" style="color:#2A6A78;text-decoration:none;">legalmev.com.ar</a>
      &nbsp;·&nbsp;
      <a href="${BASE}/landing/politica-privacidad" style="color:#6b7280;text-decoration:none;">Política de privacidad</a>
    </p>
    <p style="margin:0;font-size:12px;color:#9ca3af;">contacto@legalmev.com.ar</p>
    <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} LegalMev. Todos los derechos reservados.</p>
  </div>`;
}

function ctaButton(href: string, text: string): string {
  return `
  <p style="margin:0 0 24px;text-align:center;">
    <a href="${href}" style="display:inline-block;padding:14px 32px;background-color:#2A6A78;color:#fff !important;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">${text}</a>
  </p>
  <p style="margin:0 0 24px;text-align:center;font-size:13px;color:#6b7280;">
    Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
    <a href="${href}" style="color:#2A6A78;word-break:break-all;">${href}</a>
  </p>`;
}

export function buildVerificationEmailHtml(verifyUrl: string): string {
  const content = `
    <p style="margin:0 0 16px;font-size:16px;">Hola,</p>
    <p style="margin:0 0 24px;">Verificá tu correo electrónico para activar tu cuenta en LegalMev. Hacé clic en el botón de abajo.</p>
    ${ctaButton(verifyUrl, 'Verificar mi email')}
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Este link vence en 1 hora por seguridad.</p>
    <p style="margin:0;font-size:14px;color:#6b7280;">Si no pediste esto, ignorá este correo.</p>
    <p style="margin:24px 0 0;font-size:14px;color:#9ca3af;">— El equipo de LegalMev</p>
  `;
  return emailWrapper(emailHeader() + emailCard(content) + emailFooter());
}

export function buildInviteEmailHtml(params: {
  colegioName: string;
  actionUrl: string;
  isNewUser: boolean;
}): string {
  const { actionUrl, isNewUser } = params;
  const colegioName = escapeHtml(params.colegioName);
  const ctaText = isNewUser ? 'Crear mi cuenta y contraseña' : 'Configurar mi contraseña';
  const intro = isNewUser
    ? `Fuiste designado responsable del Colegio de Abogados "${colegioName}". Creá tu cuenta y contraseña para acceder al panel y administrar la lista de colegiados autorizados.`
    : `Fuiste designado responsable del Colegio de Abogados "${colegioName}". Configurá tu contraseña para acceder al panel y administrar la lista de colegiados autorizados.`;

  const content = `
    <p style="margin:0 0 16px;font-size:16px;">Hola,</p>
    <p style="margin:0 0 24px;">${intro}</p>
    ${ctaButton(actionUrl, ctaText)}
    <p style="margin:0;font-size:14px;color:#6b7280;">Si no esperabas este correo, ignorá este mensaje.</p>
    <p style="margin:24px 0 0;font-size:14px;color:#9ca3af;">— El equipo de LegalMev</p>
  `;
  return emailWrapper(emailHeader() + emailCard(content) + emailFooter());
}

export function buildTestEmailHtml(fromAddress: string): string {
  const safeFrom = escapeHtml(fromAddress);
  const content = `
    <p style="margin:0 0 16px;font-size:16px;">Hola,</p>
    <p style="margin:0 0 24px;">Este es un correo de <strong>prueba</strong> desde LegalMev. Si lo recibiste, Resend está funcionando correctamente.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Remitente configurado: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${safeFrom}</code></p>
    <p style="margin:0;font-size:14px;color:#9ca3af;">— El equipo de LegalMev</p>
  `;
  return emailWrapper(emailHeader() + emailCard(content) + emailFooter());
}

export function buildPaymentSuccessHtml(params: {
  userName?: string;
  amount: string;
  currency: string;
}): string {
  const greeting = params.userName ? `Hola ${escapeHtml(params.userName.split(' ')[0])},` : 'Hola,';
  const content = `
    <p style="margin:0 0 16px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 24px;">Se cobró tu suscripción mensual de LegalMev.</p>
    <p style="margin:0 0 24px;font-size:18px;font-weight:600;color:#2A6A78;">${escapeHtml(params.amount)}</p>
    <p style="margin:0 0 24px;">Tu plan premium sigue activo. Gracias por confiar en nosotros.</p>
    ${ctaButton(`${BASE}/dashboard`, 'Ir al dashboard')}
    <p style="margin:0;font-size:14px;color:#9ca3af;">— El equipo de LegalMev</p>
  `;
  return emailWrapper(emailHeader() + emailCard(content) + emailFooter());
}

export function buildPaymentRejectedHtml(params: { userName?: string }): string {
  const greeting = params.userName ? `Hola ${escapeHtml(params.userName.split(' ')[0])},` : 'Hola,';
  const content = `
    <p style="margin:0 0 16px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 24px;">Tu último pago de la suscripción LegalMev <strong>fue rechazado</strong>.</p>
    <p style="margin:0 0 24px;">Posibles motivos: tarjeta vencida, fondos insuficientes, o bloqueo del banco.</p>
    <p style="margin:0 0 24px;">Tenés <strong>10 días</strong> para actualizar tu medio de pago. Si no renovás, perderás el acceso y no podrás exportar más expedientes.</p>
    ${ctaButton(`${BASE}/dashboard`, 'Actualizar forma de pago')}
    <p style="margin:0;font-size:14px;color:#6b7280;">Si tenés dudas, contactanos.</p>
    <p style="margin:24px 0 0;font-size:14px;color:#9ca3af;">— El equipo de LegalMev</p>
  `;
  return emailWrapper(emailHeader() + emailCard(content) + emailFooter());
}

export function buildConvenioSuspendedHtml(params: { colegioName: string }): string {
  const colegioName = escapeHtml(params.colegioName);
  const content = `
    <p style="margin:0 0 16px;font-size:16px;">Hola,</p>
    <p style="margin:0 0 24px;">El convenio del Colegio de Abogados <strong>${colegioName}</strong> con LegalMev fue suspendido.</p>
    <p style="margin:0 0 24px;">Tu acceso premium por convenio ya no está activo. Si necesitás seguir exportando expedientes, podés pasar al plan premium individual desde el dashboard.</p>
    ${ctaButton(`${BASE}/dashboard`, 'Ir al dashboard')}
    <p style="margin:0;font-size:14px;color:#6b7280;">Si tenés dudas, contactá al administrador de tu colegio o a LegalMev.</p>
    <p style="margin:24px 0 0;font-size:14px;color:#9ca3af;">— El equipo de LegalMev</p>
  `;
  return emailWrapper(emailHeader() + emailCard(content) + emailFooter());
}
