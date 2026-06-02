import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type InvoicePdfData = {
  tipoComprobante?: string;
  cbteTipo?: number;
  puntoVenta?: number | string | null;
  numero?: number | string | null;
  fecha?: Date | string | null;
  cae: string;
  caeFchVto?: string | null;
  receptor?: {
    razonSocial?: string | null;
    cuit?: string | null;
    email?: string | null;
    domicilio?: string | null;
  };
  descripcion?: string | null;
  netoGravado?: number | null;
  iva?: number | null;
  total?: number | null;
};

const EMISOR = {
  razonSocial: 'NOTIFICAS S. R. L.',
  cuit: '33-71729868-9',
  domicilio: 'Colon 12 Piso 1 - San Nicolas - Buenos Aires',
  ingresosBrutos: '33717298689',
  inicioActividades: '01/05/2022',
  condicionIva: 'IVA Responsable Inscripto',
};

const COLORS = {
  ink: [15, 23, 42] as const,
  muted: [100, 116, 139] as const,
  line: [203, 213, 225] as const,
  soft: [248, 250, 252] as const,
  brand: [42, 106, 120] as const,
  brandDark: [30, 80, 92] as const,
  brandSoft: [232, 245, 247] as const,
};

function setTextColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function setDrawColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setFillColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function money(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return v.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
}

function padNumber(value: number | string | null | undefined, len: number): string {
  const raw = value == null ? '' : String(value).replace(/\D/g, '');
  return (raw || '0').padStart(len, '0');
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return new Date().toLocaleDateString('es-AR');
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-AR');
}

function formatCaeDate(value: string | null | undefined): string {
  const raw = value?.replace(/\D/g, '') ?? '';
  if (raw.length !== 8) return value ?? '';
  return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
}

function formatQrDate(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function comprobanteLabel(tipo?: string, cbteTipo?: number): string {
  if (tipo === 'A' || cbteTipo === 1) return 'FACTURA A';
  if (tipo === 'C' || cbteTipo === 11) return 'FACTURA C';
  return 'FACTURA B';
}

function comprobanteCodigo(tipo?: string, cbteTipo?: number): string {
  if (tipo === 'A' || cbteTipo === 1) return '001';
  if (tipo === 'C' || cbteTipo === 11) return '011';
  return '006';
}

function drawBrandMark(doc: jsPDF, x: number, y: number, size: number) {
  setFillColor(doc, COLORS.brand);
  doc.roundedRect(x, y, size, size, 10, 10, 'F');
  setFillColor(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LM', x + size / 2, y + size / 2 + 5, { align: 'center' });
}

function loadLogoImage(): { dataUrl: string; format: 'JPEG' | 'PNG' } | null {
  const candidates: Array<{ file: string; format: 'JPEG' | 'PNG'; mime: string }> = [
    { file: 'logo.png', format: 'PNG', mime: 'image/png' },
    { file: 'logo.jpg', format: 'JPEG', mime: 'image/jpeg' },
  ];

  for (const candidate of candidates) {
    const logoPath = path.join(process.cwd(), 'public', candidate.file);
    if (!existsSync(logoPath)) continue;
    const image = readFileSync(logoPath);
    return {
      dataUrl: `data:${candidate.mime};base64,${image.toString('base64')}`,
      format: candidate.format,
    };
  }

  return null;
}

function drawLabelValue(doc: jsPDF, label: string, value: string, x: number, y: number) {
  setTextColor(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(label.toUpperCase(), x, y);
  setTextColor(doc, COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(value || '-', x, y + 13);
}

function receptorDocumentoForQr(receptor?: InvoicePdfData['receptor']) {
  const digits = receptor?.cuit?.replace(/\D/g, '') ?? '';
  if (digits.length === 11) return { tipoDocRec: 80, nroDocRec: Number(digits) };
  if (digits.length >= 6 && digits.length <= 8) return { tipoDocRec: 96, nroDocRec: Number(digits) };
  return { tipoDocRec: 99, nroDocRec: 0 };
}

function buildArcaQrUrl(data: InvoicePdfData): string {
  const receptorDoc = receptorDocumentoForQr(data.receptor);
  const payload = {
    ver: 1,
    fecha: formatQrDate(data.fecha),
    cuit: 33717298689,
    ptoVta: Number(padNumber(data.puntoVenta, 5)),
    tipoCmp: Number(comprobanteCodigo(data.tipoComprobante, data.cbteTipo)),
    nroCmp: Number(padNumber(data.numero, 8)),
    importe: Number((data.total ?? 0).toFixed(2)),
    moneda: 'PES',
    ctz: 1,
    ...receptorDoc,
    tipoCodAut: 'E',
    codAut: Number(data.cae),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return `https://www.afip.gob.ar/fe/qr/?p=${encodeURIComponent(encoded)}`;
}

function drawQrCode(doc: jsPDF, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const moduleSize = size / qr.modules.size;

  setFillColor(doc, [255, 255, 255]);
  doc.rect(x, y, size, size, 'F');
  setFillColor(doc, COLORS.ink);
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let col = 0; col < qr.modules.size; col += 1) {
      if (qr.modules.get(col, row)) {
        doc.rect(
          x + col * moduleSize,
          y + row * moduleSize,
          Math.ceil(moduleSize),
          Math.ceil(moduleSize),
          'F',
        );
      }
    }
  }
}

export function buildInvoicePdfBuffer(data: InvoicePdfData): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const left = 42;
  const right = width - 42;
  const label = comprobanteLabel(data.tipoComprobante, data.cbteTipo);
  const code = comprobanteCodigo(data.tipoComprobante, data.cbteTipo);
  const pv = padNumber(data.puntoVenta, 5);
  const nro = padNumber(data.numero, 8);
  const total = data.total ?? 0;
  const qrUrl = buildArcaQrUrl(data);

  setFillColor(doc, COLORS.soft);
  doc.rect(0, 0, width, height, 'F');

  setFillColor(doc, [255, 255, 255]);
  setDrawColor(doc, COLORS.line);
  doc.roundedRect(left - 12, 28, right - left + 24, 756, 12, 12, 'FD');

  const logo = loadLogoImage();
  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, left, 48, 50, 50);
  } else {
    drawBrandMark(doc, left, 50, 44);
  }
  setTextColor(doc, COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('LegalMev', left + 58, 67);
  setTextColor(doc, COLORS.muted);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Exportacion de expedientes judiciales', left + 58, 82);
  doc.text(EMISOR.razonSocial, left + 58, 97);

  setFillColor(doc, COLORS.brand);
  doc.roundedRect(right - 166, 44, 124, 30, 15, 15, 'F');
  setTextColor(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(label, right - 104, 64, { align: 'center' });

  setTextColor(doc, COLORS.ink);
  doc.setFontSize(9);
  doc.text(`Codigo ${code}`, right - 104, 91, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Comp. ${pv}-${nro}`, right - 104, 106, { align: 'center' });

  setDrawColor(doc, COLORS.line);
  doc.line(left, 126, right, 126);

  drawLabelValue(doc, 'Fecha de emision', formatDate(data.fecha), left, 150);
  drawLabelValue(doc, 'CUIT emisor', EMISOR.cuit, left + 140, 150);
  drawLabelValue(doc, 'Condicion IVA', EMISOR.condicionIva, left + 260, 150);
  drawLabelValue(doc, 'Inicio actividades', EMISOR.inicioActividades, right - 112, 150);

  setTextColor(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Domicilio comercial: ${EMISOR.domicilio}`, left, 188);
  doc.text(`Ingresos brutos: ${EMISOR.ingresosBrutos}`, left, 203);

  setFillColor(doc, COLORS.soft);
  setDrawColor(doc, COLORS.line);
  doc.roundedRect(left, 226, right - left, 74, 8, 8, 'FD');
  setTextColor(doc, COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Receptor', left + 14, 247);
  doc.setFont('helvetica', 'normal');
  setTextColor(doc, COLORS.muted);
  doc.text(`Razon social: ${data.receptor?.razonSocial || 'Consumidor final'}`, left + 14, 265);
  doc.text(`CUIT/DNI: ${data.receptor?.cuit || 'Consumidor final'}`, left + 14, 281);
  doc.text(`Email: ${data.receptor?.email || '-'}`, left + 266, 265);
  doc.text(`Domicilio: ${data.receptor?.domicilio || '-'}`, left + 266, 281);

  const tableTop = 328;
  setDrawColor(doc, COLORS.line);
  doc.roundedRect(left, tableTop, right - left, 154, 8, 8, 'S');
  setFillColor(doc, COLORS.brand);
  doc.roundedRect(left, tableTop, right - left, 28, 8, 8, 'F');
  setFillColor(doc, COLORS.brand);
  doc.rect(left, tableTop + 14, right - left, 14, 'F');
  doc.line(right - 128, tableTop, right - 128, tableTop + 154);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setTextColor(doc, [255, 255, 255]);
  doc.text('Descripcion', left + 14, tableTop + 18);
  doc.text('Importe', right - 16, tableTop + 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setTextColor(doc, COLORS.ink);
  const description = data.descripcion || 'Servicio LegalMev';
  const descriptionLines = doc.splitTextToSize(description, right - left - 158);
  doc.text(descriptionLines, left + 14, tableTop + 56);
  doc.text(money(total), right - 16, tableTop + 56, { align: 'right' });

  const totalsTop = 510;
  setFillColor(doc, COLORS.soft);
  setDrawColor(doc, COLORS.line);
  doc.roundedRect(right - 210, totalsTop - 20, 210, 98, 8, 8, 'FD');
  setTextColor(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Neto gravado', right - 190, totalsTop);
  setTextColor(doc, COLORS.ink);
  doc.text(money(data.netoGravado), right - 16, totalsTop, { align: 'right' });
  setTextColor(doc, COLORS.muted);
  doc.text('IVA 21%', right - 190, totalsTop + 20);
  setTextColor(doc, COLORS.ink);
  doc.text(money(data.iva), right - 16, totalsTop + 20, { align: 'right' });
  setDrawColor(doc, COLORS.line);
  doc.line(right - 190, totalsTop + 36, right - 16, totalsTop + 36);
  setTextColor(doc, COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TOTAL', right - 190, totalsTop + 60);
  doc.text(money(total), right - 16, totalsTop + 60, { align: 'right' });

  setFillColor(doc, COLORS.brandSoft);
  setDrawColor(doc, COLORS.brand);
  doc.roundedRect(left, 610, right - left, 92, 8, 8, 'FD');
  setTextColor(doc, COLORS.brandDark);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Comprobante electronico autorizado por ARCA/AFIP', left + 14, 632);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`CAE: ${data.cae}`, left + 14, 653);
  doc.text(`Vencimiento CAE: ${formatCaeDate(data.caeFchVto)}`, left + 14, 672);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Escanea el QR para verificar el comprobante en ARCA.', left + 14, 690);

  setDrawColor(doc, COLORS.line);
  doc.roundedRect(right - 96, 616, 72, 72, 5, 5, 'S');
  drawQrCode(doc, qrUrl, right - 91, 621, 62);

  doc.setFont('helvetica', 'normal');
  setTextColor(doc, COLORS.muted);
  doc.setFontSize(8);
  doc.text(
    'PDF generado por LegalMev a partir del comprobante electronico autorizado (Notificas S.R.L.).',
    left,
    742,
  );
  setDrawColor(doc, COLORS.line);
  doc.line(left, 758, right, 758);
  doc.text('www.legalmev.com.ar', left, 776);
  doc.text('Historial de pagos en tu cuenta LegalMev.', right, 776, {
    align: 'right',
  });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
