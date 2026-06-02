import { FieldValue } from 'firebase-admin/firestore';

export type BillingHubResult =
  | {
      ok: true;
      facturaId?: string;
      CAE?: string;
      CAEFchVto?: string;
      voucherNumber?: number;
      ptoVta?: number;
      cbteTipo?: number;
      tipoComprobante?: string;
      netoGravado?: number;
      iva?: number;
      total?: number;
      alreadyIssued?: boolean;
    }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string; status?: number };

type BillingHubPersistStatus = 'issued' | 'pending' | 'failed';

export type HubInvoiceBuyer = {
  email?: string;
  razonSocial?: string;
  cuit?: string;
  dni?: string;
  domicilio?: string;
  ivaCondicion?: string;
};

export type RequestHubInvoiceInput = {
  /** Id del pago en Mercado Pago */
  paymentId: string;
  amount: number;
  preferenceId?: string;
  externalReference?: string;
  buyer: HubInvoiceBuyer;
  item: {
    description: string;
    planName?: string;
  };
  metadata?: Record<string, unknown>;
  /** Doc Firestore `pagos/{id}` para guardar estado de facturación */
  pagoDocId?: string;
};

function billingEmitUrl(): string | undefined {
  const explicit =
    process.env.NOTIFICASHUB_BILLING_EMIT_URL ||
    process.env.NOTIFICAS_HUB_BILLING_EMIT_URL;
  const explicitUrl = explicit?.trim();
  if (explicitUrl) return explicitUrl;

  const hubBase = process.env.NOTIFICASHUB_URL?.trim().replace(/\/+$/, '');
  if (!hubBase) return undefined;

  return `${hubBase}/api/integrations/notificas/billing/emit`;
}

function billingSharedSecret(): string | undefined {
  const raw =
    process.env.NOTIFICAS_BILLING_SHARED_SECRET ||
    process.env.NOTIFICASHUB_BILLING_SHARED_SECRET ||
    process.env.LEGALMEV_BILLING_SHARED_SECRET;
  const secret = raw?.trim();
  return secret || undefined;
}

function hubEmitEnabled(): boolean {
  return (
    process.env.MERCADOPAGO_HUB_EMIT_FACTURA === 'true' ||
    process.env.LEGALMEV_HUB_EMIT_FACTURA === 'true' ||
    process.env.NOTIFICASHUB_BILLING_FORCE_EMIT === 'true'
  );
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function digits(value: unknown, max = 32): string | undefined {
  const d = asString(value)?.replace(/\D/g, '').slice(0, max);
  return d || undefined;
}

function limitText(value: string | undefined, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function hubErrorMessage(json: Record<string, unknown>, status: number): string {
  const explicit = asString(json.error) || asString(json.message);
  if (explicit && !explicit.trimStart().startsWith('<!DOCTYPE html')) {
    return explicit;
  }
  if (status === 404) {
    return 'Endpoint de facturación del Hub no encontrado';
  }
  return `Hub respondió HTTP ${status}`;
}

function buildBillingHubProblem(opts: {
  status: BillingHubPersistStatus;
  reason?: string;
  error?: string;
  httpStatus?: number;
}) {
  return {
    status: opts.status,
    facturaId: null,
    cae: null,
    caeFchVto: null,
    voucherNumber: null,
    ptoVta: null,
    cbteTipo: null,
    tipoComprobante: null,
    reason: limitText(opts.reason),
    error: limitText(opts.error),
    httpStatus: opts.httpStatus ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistPaymentBillingHub(adminDb: any, pagoDocId: string | undefined, billingHub: Record<string, unknown>) {
  if (!pagoDocId) return;

  const ref = adminDb.collection('pagos').doc(pagoDocId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const current = snap.data()?.billingHub as { status?: string } | undefined;
  if (billingHub.status !== 'issued' && current?.status === 'issued') {
    return;
  }

  await ref.set({ billingHub }, { merge: true });
}

/**
 * Pide a NotificasHub que emite factura ARCA (Notificas S.R.L.) para un pago MP de LegalMev.
 * No bloquea la acreditación del servicio ante error fiscal.
 */
export async function requestHubInvoiceForLegalMevPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminDb: any,
  input: RequestHubInvoiceInput
): Promise<BillingHubResult> {
  const paymentIdStr = String(input.paymentId).trim();
  if (!paymentIdStr) {
    return { ok: false, error: 'paymentId vacío' };
  }

  if (!hubEmitEnabled()) {
    await persistPaymentBillingHub(adminDb, input.pagoDocId, buildBillingHubProblem({
      status: 'failed',
      reason: 'hub_emit_factura_not_enabled',
    }));
    return { ok: false, skipped: true, reason: 'hub_emit_factura_not_enabled' };
  }

  const url = billingEmitUrl();
  const secret = billingSharedSecret();
  if (!url || !secret) {
    await persistPaymentBillingHub(adminDb, input.pagoDocId, buildBillingHubProblem({
      status: 'failed',
      reason: 'hub_billing_not_configured',
    }));
    return { ok: false, skipped: true, reason: 'hub_billing_not_configured' };
  }

  const amount = input.amount;
  if (!Number.isFinite(amount) || amount <= 0) {
    await persistPaymentBillingHub(adminDb, input.pagoDocId, buildBillingHubProblem({
      status: 'failed',
      error: 'Importe inválido para facturación Hub',
    }));
    return { ok: false, error: 'Importe inválido para facturación Hub' };
  }

  const cbteTipoEnv = process.env.MERCADOPAGO_HUB_CBTE_TIPO || process.env.LEGALMEV_HUB_CBTE_TIPO;
  const cbteTipo =
    cbteTipoEnv === 'A' || cbteTipoEnv === 'B' || cbteTipoEnv === 'C' ? cbteTipoEnv : undefined;

  const payload = {
    idempotencyKey: `legalmev_mp_${paymentIdStr}`,
    paymentId: paymentIdStr,
    preferenceId: input.preferenceId,
    amount,
    amountIncludesVat: true,
    cbteTipo,
    buyer: {
      email: input.buyer.email,
      razonSocial: input.buyer.razonSocial,
      cuit: digits(input.buyer.cuit, 11),
      dni: digits(input.buyer.dni, 8),
      ivaCondicion: input.buyer.ivaCondicion,
      domicilio: input.buyer.domicilio,
    },
    item: {
      planName: input.item.planName,
      description: input.item.description,
    },
    metadata: {
      source_app: 'legalmev',
      external_reference: input.externalReference,
      ...input.metadata,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo contactar al Hub';
    await persistPaymentBillingHub(adminDb, input.pagoDocId, buildBillingHubProblem({
      status: 'failed',
      error: msg,
    }));
    return { ok: false, error: msg };
  }

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { error: text.slice(0, 300) };
  }

  if (!response.ok) {
    const error = hubErrorMessage(json, response.status);
    await persistPaymentBillingHub(adminDb, input.pagoDocId, buildBillingHubProblem({
      status: 'failed',
      error,
      httpStatus: response.status,
    }));
    return { ok: false, status: response.status, error };
  }

  if (json.ok === false) {
    const reason = asString(json.status) || asString(json.message) || 'hub_invoice_not_ready';
    await persistPaymentBillingHub(adminDb, input.pagoDocId, buildBillingHubProblem({
      status: 'pending',
      reason,
    }));
    return { ok: false, skipped: true, reason };
  }

  const result: BillingHubResult = {
    ok: true,
    facturaId: asString(json.facturaId),
    CAE: asString(json.CAE),
    CAEFchVto: asString(json.CAEFchVto),
    voucherNumber: typeof json.voucherNumber === 'number' ? json.voucherNumber : undefined,
    ptoVta: typeof json.ptoVta === 'number' ? json.ptoVta : undefined,
    cbteTipo: typeof json.cbteTipo === 'number' ? json.cbteTipo : undefined,
    tipoComprobante: asString(json.tipoComprobante),
    netoGravado: typeof json.netoGravado === 'number' ? json.netoGravado : undefined,
    iva: typeof json.iva === 'number' ? json.iva : undefined,
    total: typeof json.total === 'number' ? json.total : undefined,
    alreadyIssued: json.alreadyIssued === true,
  };

  if (!result.ok) {
    return result;
  }

  await persistPaymentBillingHub(adminDb, input.pagoDocId, {
    status: 'issued',
    facturaId: result.facturaId ?? null,
    cae: result.CAE ?? null,
    caeFchVto: result.CAEFchVto ?? null,
    voucherNumber: result.voucherNumber ?? null,
    ptoVta: result.ptoVta ?? null,
    cbteTipo: result.cbteTipo ?? null,
    tipoComprobante: result.tipoComprobante ?? null,
    netoGravado: result.netoGravado ?? null,
    iva: result.iva ?? null,
    total: result.total ?? amount,
    buyerRazonSocial: payload.buyer.razonSocial || null,
    buyerCuit: payload.buyer.cuit || null,
    buyerEmail: payload.buyer.email || null,
    alreadyIssued: result.alreadyIssued ?? false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return result;
}
