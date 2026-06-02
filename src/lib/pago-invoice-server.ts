import { NextResponse } from 'next/server';
import { buildInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { requestHubInvoiceForLegalMevPayment, type HubInvoiceBuyer } from '@/lib/hub-billing';

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

/**
 * Genera PDF de factura para un doc `pagos/{id}` ya autorizado.
 * Reintenta emisión Hub si el pago es Mercado Pago y aún no hay CAE.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function servePagoInvoicePdf(
  adminDb: any,
  pagoId: string,
  data: Record<string, unknown>,
  buyer: HubInvoiceBuyer,
  defaultDescription: string
): Promise<NextResponse> {
  let billingHub = (data.billingHub ?? {}) as Record<string, unknown>;
  let cae = asString(billingHub.cae);

  if (billingHub.status !== 'issued' || !cae) {
    const mpPaymentId = asString(data.referenciaExterna);
    if (mpPaymentId && data.metodo === 'mercadopago') {
      await requestHubInvoiceForLegalMevPayment(adminDb, {
        paymentId: mpPaymentId,
        amount: Number(data.monto) || 0,
        buyer,
        item: { description: asString(data.descripcion) ?? defaultDescription },
        pagoDocId: pagoId,
      });
      const refreshed = await adminDb.collection('pagos').doc(pagoId).get();
      billingHub = (refreshed.data()?.billingHub ?? {}) as Record<string, unknown>;
      cae = asString(billingHub.cae);
    }
  }

  if (billingHub.status !== 'issued' || !cae) {
    return NextResponse.json({ error: 'La factura todavía no está disponible' }, { status: 404 });
  }

  const pdf = buildInvoicePdfBuffer({
    tipoComprobante: asString(billingHub.tipoComprobante) ?? undefined,
    cbteTipo: asNumber(billingHub.cbteTipo) ?? undefined,
    puntoVenta: asNumber(billingHub.ptoVta) ?? undefined,
    numero: asNumber(billingHub.voucherNumber) ?? undefined,
    fecha: asString(data.createdAt) ?? new Date(),
    cae,
    caeFchVto: asString(billingHub.caeFchVto),
    receptor: {
      razonSocial: asString(billingHub.buyerRazonSocial) ?? buyer.razonSocial,
      cuit: asString(billingHub.buyerCuit) ?? buyer.cuit,
      email: asString(billingHub.buyerEmail) ?? buyer.email,
      domicilio: buyer.domicilio,
    },
    descripcion: asString(data.descripcion),
    netoGravado: asNumber(billingHub.netoGravado),
    iva: asNumber(billingHub.iva),
    total: asNumber(billingHub.total) ?? asNumber(data.monto),
  });

  const pv = String(asNumber(billingHub.ptoVta) ?? 0).padStart(5, '0');
  const nro = String(asNumber(billingHub.voucherNumber) ?? 0).padStart(8, '0');

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="factura-${pv}-${nro}.pdf"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}

export function buyerFromColegioData(colegioData: Record<string, unknown>): HubInvoiceBuyer {
  const name = (colegioData.name as string)?.trim();
  const cuitRaw = (colegioData.cuit ?? colegioData.document) as string | undefined;
  return {
    email: (colegioData.contactoFacturacion as string) || undefined,
    razonSocial: name || undefined,
    cuit: cuitRaw,
  };
}
