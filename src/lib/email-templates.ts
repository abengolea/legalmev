/**
 * Plantillas HTML compartidas para emails de LegalMev.
 * Colores: #2A6A78 (primary), #54A6A8 (accent).
 */

import { CONTACT_EMAIL } from '@/lib/site-contact';
import { SUPPORTED_PORTALS_EMAIL_TAGLINE } from '@/lib/supported-portals';

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
    <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${SUPPORTED_PORTALS_EMAIL_TAGLINE}</p>
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
      <a href="${BASE}/landing/bases-y-condiciones" style="color:#6b7280;text-decoration:none;">Bases y condiciones</a>
      &nbsp;·&nbsp;
      <a href="${BASE}/landing/politica-privacidad" style="color:#6b7280;text-decoration:none;">Política de privacidad</a>
    </p>
    <p style="margin:0;font-size:12px;color:#9ca3af;"><a href="mailto:${CONTACT_EMAIL}" style="color:#9ca3af;text-decoration:none;">${CONTACT_EMAIL}</a></p>
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

/** Invitación general a crear cuenta / conocer LegalMev (no ligada a un colegio). */
export function buildUserInviteEmailHtml(params: {
  registerUrl: string;
  customMessage?: string;
}): string {
  const custom = params.customMessage?.trim()
    ? `<p style="margin:0 0 24px;">${escapeHtml(params.customMessage.trim()).replace(/\n/g, '<br>')}</p>`
    : '';

  const content = `
    <p style="margin:0 0 16px;font-size:16px;">Hola,</p>
    <p style="margin:0 0 24px;">
      Te invitamos a conocer <strong>LegalMev</strong>: la herramienta para abogados que exporta
      expedientes completos a PDF desde la MEV de la SCBA (civiles y penales), PJN, Salta, Entre Ríos y Tucumán.
    </p>
    ${custom}
    <div style="margin:0 0 24px;padding:16px 18px;background:#f0f7f8;border-radius:8px;border-left:4px solid #2A6A78;">
      <p style="margin:0 0 12px;font-weight:600;color:#2A6A78;">¿Qué podés hacer?</p>
      <ul style="margin:0;padding-left:20px;color:#374151;font-size:15px;line-height:1.7;">
        <li>Exportar expedientes a PDF con un clic desde la extensión de Chrome (sin límites y totalmente gratis).</li>
        <li>Usar herramientas como Control de prueba y Copiloto de Audiencias.</li>
      </ul>
    </div>
    ${ctaButton(params.registerUrl, 'Crear mi cuenta gratis')}
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
      Si ya tenés cuenta, podés iniciar sesión en
      <a href="${BASE}/login" style="color:#2A6A78;">legalmev.com.ar</a>.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;">Si no esperabas este correo, podés ignorarlo.</p>
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
    <p style="margin:0 0 24px;">La exportación de expedientes a PDF sigue siendo gratuita e ilimitada para todos los usuarios. Otras funcionalidades vinculadas al convenio pueden haberse visto afectadas.</p>
    ${ctaButton(`${BASE}/dashboard`, 'Ir al dashboard')}
    <p style="margin:0;font-size:14px;color:#6b7280;">Si tenés dudas, contactá al administrador de tu colegio o a LegalMev.</p>
    <p style="margin:24px 0 0;font-size:14px;color:#9ca3af;">— El equipo de LegalMev</p>
  `;
  return emailWrapper(emailHeader() + emailCard(content) + emailFooter());
}

export function buildResourceShareEmailHtml(params: {
  recipientName?: string;
  sharerName: string;
  resourceLabel: string;
  resourceTitle: string;
  role: 'view' | 'edit';
  actionUrl: string;
}): string {
  const recipient = params.recipientName?.trim();
  const greeting = recipient ? `Hola ${escapeHtml(recipient.split(' ')[0])},` : 'Hola,';
  const sharer = escapeHtml(params.sharerName.trim() || 'Un usuario de LegalMev');
  const title = escapeHtml(params.resourceTitle.trim() || 'Sin título');
  const label = escapeHtml(params.resourceLabel);
  const roleText = params.role === 'edit' ? 'editar' : 'ver';

  const content = `
    <p style="margin:0 0 16px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 24px;">
      <strong>${sharer}</strong> te compartió un <strong>${label}</strong> en LegalMev
      con permiso para <strong>${roleText}</strong>.
    </p>
    <div style="margin:0 0 24px;padding:16px 18px;background:#f0f7f8;border-radius:8px;border-left:4px solid #2A6A78;">
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
        <strong style="color:#2A6A78;">${title}</strong>
      </p>
    </div>
    ${ctaButton(params.actionUrl, 'Abrir en LegalMev')}
    <p style="margin:0;font-size:14px;color:#6b7280;">Si no esperabas este correo, podés ignorarlo.</p>
    <p style="margin:24px 0 0;font-size:14px;color:#9ca3af;">— El equipo de LegalMev</p>
  `;
  return emailWrapper(emailHeader() + emailCard(content) + emailFooter());
}

export function buildCopilotoAudienciaAnnouncementHtml(params: {
  firstName?: string;
  copilotUrl?: string;
}): string {
  const firstName = params.firstName?.trim();
  const greeting = firstName ? `Hola ${escapeHtml(firstName)},` : 'Hola,';
  const copilotUrl = params.copilotUrl || `${BASE}/dashboard/copiloto-audiencias`;

  const content = `
    <p style="margin:0 0 16px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 24px;">
      LegalMev suma el <strong>Copiloto de Audiencias</strong>: un asistente con inteligencia artificial
      para preparar y conducir audiencias a partir del expediente que exportás desde MEV/PJN.
    </p>
    <div style="margin:0 0 24px;padding:16px 18px;background:#f0f7f8;border-radius:8px;border-left:4px solid #2A6A78;">
      <p style="margin:0 0 12px;font-weight:600;color:#2A6A78;">¿Qué hace?</p>
      <ul style="margin:0;padding-left:20px;color:#374151;font-size:15px;line-height:1.7;">
        <li>Analiza el expediente y resume partes, hechos, prueba y testigos.</li>
        <li>Sugiere preguntas mientras interrogás a cada declarante.</li>
        <li>Detecta contradicciones, admisiones y evasivas en tiempo real.</li>
        <li>Arma un borrador de alegatos de cierre con todos los testimonios.</li>
      </ul>
    </div>
    <p style="margin:0 0 8px;font-size:15px;">
      <strong>Tu cuenta incluye 1 audiencia de prueba gratuita</strong> para conocer el copiloto.
    </p>
    <div style="margin:0 0 24px;padding:16px 18px;background:#fffbeb;border-radius:8px;border-left:4px solid #d97706;">
      <p style="margin:0 0 10px;font-weight:600;color:#92400e;">Estamos en fase de prueba</p>
      <p style="margin:0;font-size:14px;color:#78350f;line-height:1.7;">
        Tu opinión nos ayuda mucho: contanos qué te resultó útil, qué mejorarías o si encontraste
        algún error. Con casos reales vamos afinando la herramienta antes de definir el servicio
        comercial.
      </p>
    </div>
    ${ctaButton(copilotUrl, 'Probar el Copiloto de Audiencias')}
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
      Entrá a LegalMev, cargá el PDF exportado (con texto seleccionable) e indicá a quién representás.
      Todo queda guardado en la nube para retomarlo cuando quieras.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
      Sugerencias, mejoras o reporte de errores: escribinos a
      <a href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Copiloto de Audiencias — sugerencias')}" style="color:#2A6A78;">${CONTACT_EMAIL}</a>.
    </p>
    <p style="margin:24px 0 0;font-size:14px;color:#9ca3af;">— El equipo de LegalMev</p>
  `;
  return emailWrapper(emailHeader() + emailCard(content) + emailFooter());
}
