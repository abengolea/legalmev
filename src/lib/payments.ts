export type PaymentTipo = 'cliente' | 'colegio';
export type PaymentMetodo = 'mercadopago' | 'dlocal' | 'stripe' | 'manual' | 'transferencia';

export type PaymentRecord = {
  tipo: PaymentTipo;
  clienteId?: string;
  colegioId?: string;
  colegioName?: string;
  monto: number;
  moneda: string;
  metodo: PaymentMetodo;
  referenciaExterna?: string;
  estado: 'completado' | 'pendiente' | 'rechazado' | 'cancelado';
  descripcion?: string;
  periodo?: string; // ej. "2025-03" para cuota mensual colegio
  createdAt: string;
  createdBy?: string;
};

/**
 * Registra un pago en la colección pagos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordPayment(adminDb: any, data: Omit<PaymentRecord, 'createdAt'>): Promise<string> {
  const doc: Record<string, unknown> = {
    ...data,
    createdAt: new Date().toISOString(),
  };
  const ref = await adminDb.collection('pagos').add(doc);
  return ref.id;
}
