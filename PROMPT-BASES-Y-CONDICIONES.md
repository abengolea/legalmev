# Prompt para generar Bases y Condiciones de LegalMEV

**Objetivo:** Usá este documento como contexto completo para que otra IA (Claude, GPT, etc.) redacte las **Bases y Condiciones** (Términos y Condiciones de uso) del producto LegalMEV. El texto generado debe ser en español, formal, jurídicamente sólido y adaptado a la legislación argentina.

---

## 1. Responsable del servicio

- **Razón social:** NOTIFICAS SRL  
- **Domicilio:** Colón 12, Primer Piso, San Nicolás de los Arroyos, Provincia de Buenos Aires, Argentina  
- **Contacto:** contacto@legalmev.com.ar  

---

## 2. Qué es LegalMEV

LegalMEV es un **software como servicio (SaaS)** compuesto por:

1. **Sitio web** (aplicación Next.js alojada en Firebase / App Hosting) donde los usuarios se registran, gestionan su cuenta, pagan y configuran la extensión.
2. **Extensión para navegador Chrome** que permite **exportar actuaciones de expedientes judiciales a archivo PDF** desde portales oficiales como:
   - MEV SCBA (Sistema de Mesa de Entradas Virtual del Colegio de Abogados de la Provincia de Buenos Aires)
   - Portal del Poder Judicial de la Nación (PJN)
   - Portal del Ministerio Público de la Provincia de Buenos Aires (MPBA)

**Público objetivo:** Abogados, profesionales legales, secretarias jurídicas y matriculados en colegios de abogados.

**Funcionamiento técnico:** La extensión opera **solo cuando el usuario está autenticado en los portales judiciales**. Lee el contenido visible de la página actual y genera el PDF localmente en el navegador. No recopila ni transmite datos personales a servidores de LegalMEV (salvo lo necesario para autenticación y control de cuotas).

---

## 3. Flujos principales

### 3.1 Registro

- El usuario se registra con nombre, apellido, email y contraseña (CUIT opcional).
- Se crea la cuenta en Firebase Authentication y un perfil en Firestore (`users/{uid}`).
- Se envía un email de verificación (Resend o Firebase).
- Si el email pertenece a un **colegio con convenio**, se le asigna automáticamente el plan **Premium**.
- Plan inicial: **Free** (5 descargas gratuitas en total).

### 3.2 Verificación de email

- La cuenta queda creada pero el usuario debe verificar su email para usar la extensión sin restricciones (según política interna).

### 3.3 Inicio de sesión

- Login con email y contraseña (Firebase Auth).
- Se puede redirigir a `/extension-connect` para vincular la extensión con la sesión.

### 3.4 Vinculación con la extensión (claim-device)

- Al conectarse, el usuario asocia su **dispositivo único** (deviceId generado por la extensión).
- El sistema **revoca todos los refresh tokens anteriores** (cierra sesiones en otros equipos).
- Solo ese dispositivo queda autorizado para usar la extensión con esa cuenta.
- Es una política de seguridad / anti-abuso: un usuario, un dispositivo.

### 3.5 Exportación de expedientes

- El usuario navega en MEV o PJN, entra a un expediente y usa la extensión para exportar a PDF.
- La extensión llama a `/api/extension/session` para validar sesión y cuota.
- Luego llama a `/api/export` para registrar la descarga y consumir cuota.
- Si la cuota se agota, el usuario debe pasar a Premium o contactar soporte.

---

## 4. Planes y cuotas

| Plan   | Cuota                           | Forma de acceso                                      |
|--------|----------------------------------|------------------------------------------------------|
| **Free** | 5 descargas en total (de por vida) | Registro gratuito. Se consume `freeDownloadsUsed`.  |
| **Premium** | Hasta 100 expedientes por mes (configurable por admin) | Pago mensual, convenio con colegio o asignación manual por admin. |

**Reglas especiales:**

- Si un usuario **nunca** tuvo Premium, tiene derecho a las 5 descargas gratuitas.
- Si un usuario **tuvo Premium por pago** y no renovó (rechazo de pago, cancelación): después de 10 días de gracia pasa a **free con subscriptionLapsed=true**, es decir **0 descargas** hasta que reactive o pague de nuevo.
- Los colegios con convenio pueden tener **cuota mensual por miembro** distinta a la global (ej. 50 expedientes/miembro).
- Los admins pueden asignar Premium por **30 días** o **permanente** (sin límite de descargas).

---

## 5. Pagos

### 5.1 Métodos de pago

- **Mercado Pago:** creación de preferencia, cobro one-time o recurrente.
- **DLocal Go:** para tarjetas internacionales y otros métodos. La entidad cobradora es NOTIFICAS SRL.
- **Pagos manuales:** transferencia, convenio con colegio (facturación directa al colegio).

### 5.2 Flujo de suscripción Premium (abogado particular)

1. Usuario va al dashboard y hace clic en "Pagar con Mercado Pago" o "Pagar con DLocal".
2. Se crea una preferencia/orden con `user_reference` = uid de Firebase.
3. Webhook (Mercado Pago o DLocal) confirma el pago.
4. Se actualiza el usuario: `tier: 'premium'`, `premiumSource: 'payment'`.
5. Si el pago es rechazado/fallido: tras 10 días sin éxito, se degrada a free con `subscriptionLapsed`.

### 5.3 Colegios con convenio

- Los colegios tienen una **lista de miembros** (emails) cargada por el admin (Excel/CSV).
- Si un miembro se registra y su email está en la lista, obtiene Premium automáticamente (`premiumSource: 'colegio'`).
- El colegio paga por convenio (cuota mensual, facturación al colegio).
- Si el convenio se suspende, todos los miembros pierden Premium de inmediato.

### 5.4 Precios

- Monto Premium configurable por el admin (ej. $6.000 ARS / mes, IVA incluido).
- Los montos y métodos se configuran en el panel de administración.

---

## 6. Datos y privacidad

- **Política de Privacidad:** Ya existe en `/landing/politica-privacidad`. Debe citarse en las Bases y Condiciones.
- La extensión **no recopila datos personales** del expediente ni los envía a servidores externos. El PDF se genera en el navegador.
- El sitio web sí almacena: email, nombre, CUIT (opcional), `deviceId` autorizado, cuotas usadas, tier, datos de pago (vía procesadores externos).

---

## 7. Administración y moderación

- **Roles:** `admin`, `abogado`, `responsable` (para colegios).
- Los admins pueden: bloquear/desbloquear usuarios, asignar/quitar Premium, resetear descargas, gestionar colegios, configurar pagos, ver estadísticas.
- Usuarios bloqueados: `status: 'bloqueado'`, `disabled: true` en Firebase Auth → no pueden iniciar sesión.

---

## 8. Restricciones técnicas importantes

1. **Un dispositivo por cuenta:** Al vincular la extensión, se revoca el acceso desde otros dispositivos.
2. **Verificación de email:** Requerida para uso pleno (según flujo actual).
3. **Portales compatibles:** Solo MEV, PJN, MPBA (o los que la extensión soporte explícitamente).
4. **Sin garantía de disponibilidad:** Los portales judiciales son de terceros; LegalMEV no garantiza que sigan accesibles ni con la misma estructura.

---

## 9. Aspectos que deben cubrir las Bases y Condiciones

Redactá las Bases y Condiciones incluyendo (como mínimo) secciones sobre:

1. **Aceptación:** Al registrarse o usar el servicio, el usuario acepta las presentes bases.
2. **Descripción del servicio y limitaciones:** Qué hace LegalMEV, qué no garantiza.
3. **Registro y cuenta:** Requisitos, verificación de email, responsabilidad del usuario sobre sus credenciales.
4. **Planes, precios y facturación:** Free vs Premium, precios, renovación, cancelación, reembolsos (si aplica).
5. **Uso aceptable:** Prohibición de uso ilegal, abusivo, revender acceso, compartir credenciales, etc.
6. **Dispositivo único / restricciones técnicas:** Explicación de la política de un dispositivo por cuenta.
7. **Propiedad intelectual:** LegalMEV y su marca son de NOTIFICAS SRL.
8. **Limitación de responsabilidad:** No se garantiza disponibilidad de portales de terceros, ni exactitud del contenido exportado.
9. **Suspensión y terminación:** Derecho a suspender o dar de baja cuentas por incumplimiento.
10. **Modificaciones:** Derecho a modificar las bases; notificación de cambios (por ejemplo, publicación en el sitio).
11. **Privacidad:** Remisión a la Política de Privacidad.
12. **Ley aplicable y jurisdicción:** Argentina, Provincia de Buenos Aires (o la que corresponda).
13. **Contacto:** contacto@legalmev.com.ar.

---

## 10. Formato esperado

- Lenguaje claro, formal, adecuado para usuarios profesionales.
- Secciones numeradas y con títulos descriptivos.
- Sin jerga técnica innecesaria; si se mencionan conceptos (ej. "cuota", "tier"), explicarlos brevemente.
- Incluir la fecha de última actualización.
- El texto final debe poder publicarse directamente en una página web (por ejemplo `/landing/bases-y-condiciones`).

---

**Instrucción final para la IA:** Con la información anterior, redactá las Bases y Condiciones completas de LegalMEV en español, listas para publicación. Adaptá el tono y el detalle según las prácticas habituales en contratos de adhesión para servicios SaaS en Argentina.
