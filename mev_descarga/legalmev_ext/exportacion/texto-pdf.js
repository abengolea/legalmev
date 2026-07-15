/**
 * Generación PDF LegalMev — textos y layout propios (SPEC-04).
 * API: buildResumenPdf, buildActuacionPdf, buildMergedPdf, buildTextPdf
 */
(function () {
  'use strict';

  const COLORS = {
    header: [42, 106, 120],
    accent: [84, 166, 168],
    text: [28, 42, 48],
    muted: [95, 115, 122],
    line: [200, 218, 222],
    soft: [236, 245, 246],
    white: [255, 255, 255],
  };

  function getJsPDF() {
    if (typeof jspdf !== 'undefined' && jspdf.jsPDF) return jspdf.jsPDF;
    if (typeof jsPDF !== 'undefined') return jsPDF;
    throw new Error('jsPDF no disponible');
  }

  function toBytes(doc) {
    const out = doc.output('arraybuffer');
    return new Uint8Array(out);
  }

  function wrap(doc, text, maxW) {
    return doc.splitTextToSize(String(text || ''), maxW);
  }

  function countAdjuntos(act) {
    if (act?.pdfBytes && act.pdfBytes.length) return 1;
    if (Array.isArray(act?.adjuntoBytes)) {
      const n = act.adjuntoBytes.filter((f) => f?.bytes && f.bytes.length).length;
      if (n) return n;
    }
    if (Array.isArray(act?.adjuntos)) {
      const n = act.adjuntos.filter((a) => a && (a.url || a.nombre || a.bytes)).length;
      if (n) return n;
    }
    if (act?.hasDoc || act?.tieneAdjunto) return 1;
    return 0;
  }

  function drawBrandBar(doc, title, pageW) {
    doc.setFillColor(...COLORS.header);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title || 'LegalMev', 14, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Exportación de expediente', pageW - 14, 14, { align: 'right' });
  }

  function drawMetaBlock(doc, datos, pageW, y) {
    const rows = [
      ['Carátula', datos.caratula || '—'],
      ['Expediente', datos.nroExpediente || '—'],
      ['Organismo', datos.juzgado || datos.dependencia || '—'],
      ['Portal', String(datos.portal || '').toUpperCase() || '—'],
      ['Jurisdicción', datos.jurisdiccion || datos.fuero || '—'],
    ];
    const labelW = 72;
    const valueW = pageW - 28 - labelW;
    doc.setFontSize(9);
    for (const [k, v] of rows) {
      doc.setTextColor(...COLORS.muted);
      doc.setFont('helvetica', 'bold');
      doc.text(`${k}:`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);
      const lines = wrap(doc, v, valueW);
      doc.text(lines, 14 + labelW, y);
      y += Math.max(12, lines.length * 11) + 2;
    }
    return y + 6;
  }

  function pieSeleccion(actuaciones) {
    let conAdj = 0;
    for (const a of actuaciones || []) if (countAdjuntos(a) > 0) conAdj += 1;
    const n = actuaciones?.length || 0;
    return `LegalMev · ${n} movimiento${n === 1 ? '' : 's'} en la selección · ${conAdj} con adjunto`;
  }

  function buildResumenPdf(datosIn) {
    const JsPDF = getJsPDF();
    const doc = new JsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const actuaciones = datosIn.actuaciones || [];

    drawBrandBar(doc, 'LegalMev — Índice', pageW);
    let y = 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.header);
    doc.text('Índice de exportación', 14, y);
    y += 14;
    y = drawMetaBlock(doc, datosIn, pageW, y);

    doc.setDrawColor(...COLORS.accent);
    doc.setLineWidth(1);
    doc.line(14, y, pageW - 14, y);
    y += 12;

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(pieSeleccion(actuaciones), 14, y);
    y += 14;

    // Cabecera de listado
    doc.setFillColor(...COLORS.soft);
    doc.rect(14, y - 8, pageW - 28, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(8);
    doc.text('#', 18, y + 2);
    doc.text('Fecha', 36, y + 2);
    doc.text('Tipo', 96, y + 2);
    doc.text('Descripción', 200, y + 2);
    y += 14;

    doc.setFont('helvetica', 'normal');
    for (let i = 0; i < actuaciones.length; i++) {
      const a = actuaciones[i];
      const desc = wrap(doc, a.descripcion || a.titulo || '', pageW - 220);
      const need = 10 + desc.length * 9;
      if (y + need > pageH - 40) {
        doc.addPage();
        drawBrandBar(doc, 'LegalMev — Índice', pageW);
        y = 36;
      }
      doc.setTextColor(...COLORS.text);
      doc.text(String(i + 1), 18, y);
      doc.text(String(a.fecha || '—').slice(0, 12), 36, y);
      doc.text(String(a.tipo || '—').slice(0, 28), 96, y);
      doc.text(desc, 200, y);
      y += Math.max(12, desc.length * 9);
      doc.setDrawColor(...COLORS.line);
      doc.line(14, y - 4, pageW - 14, y - 4);
    }

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `Generado por LegalMev · ${new Date().toLocaleString('es-AR')}`,
      14,
      pageH - 16
    );
    return toBytes(doc);
  }

  function buildActuacionPdf(act, index, datos) {
    const JsPDF = getJsPDF();
    const doc = new JsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    drawBrandBar(doc, `LegalMev — Pieza ${index}`, pageW);
    let y = 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.header);
    doc.text(`Pieza ${index}`, 14, y);
    y += 16;
    y = drawMetaBlock(doc, datos || {}, pageW, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(10);
    doc.text(String(act.tipo || 'Actuación'), 14, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Fecha: ${act.fecha || '—'}`, 14, y);
    y += 14;

    // Preservar párrafos (textos SAE / MEV con saltos de línea)
    const rawBody = String(act.contenido || act.descripcion || act.titulo || '');
    const paragraphs = rawBody.split(/\n{2,}/);
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(10);
    for (const para of paragraphs) {
      const linesInPara = para.split(/\n/).map((l) => l.trim()).filter(Boolean);
      if (!linesInPara.length) {
        y += 6;
        continue;
      }
      for (const rawLine of linesInPara) {
        const cuerpo = wrap(doc, rawLine, pageW - 28);
        for (const line of cuerpo) {
          if (y > pageH - 40) {
            doc.addPage();
            drawBrandBar(doc, `LegalMev — Pieza ${index}`, pageW);
            y = 36;
          }
          doc.text(line, 14, y);
          y += 11;
        }
      }
      y += 6;
    }

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text('LegalMev · pieza del expediente exportado', 14, pageH - 16);
    return toBytes(doc);
  }

  function buildMergedPdf(datosIn) {
    const JsPDF = getJsPDF();
    const doc = new JsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const actuaciones = datosIn.actuaciones || [];

    drawBrandBar(doc, 'LegalMev — PDF único', pageW);
    let y = 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.header);
    doc.text('Expediente (selección)', 14, y);
    y += 14;
    y = drawMetaBlock(doc, datosIn, pageW, y);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(pieSeleccion(actuaciones), 14, y);
    y += 18;

    for (let i = 0; i < actuaciones.length; i++) {
      const a = actuaciones[i];
      if (y > pageH - 80) {
        doc.addPage();
        drawBrandBar(doc, 'LegalMev — PDF único', pageW);
        y = 36;
      }
      doc.setFillColor(...COLORS.soft);
      doc.rect(14, y - 8, pageW - 28, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.header);
      doc.text(`${i + 1}. ${a.tipo || 'Actuación'} · ${a.fecha || ''}`, 18, y + 2);
      y += 16;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.muted);
      const titleLines = wrap(doc, a.descripcion || a.titulo || '', pageW - 28);
      for (const line of titleLines) {
        if (y > pageH - 40) {
          doc.addPage();
          drawBrandBar(doc, 'LegalMev — PDF único', pageW);
          y = 36;
        }
        doc.text(line, 14, y);
        y += 11;
      }
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.text);
      const body = String(a.contenido || '').trim();
      const bodyText =
        body && body !== (a.descripcion || '') && body !== (a.titulo || '')
          ? body
          : a.sinDocumentoDigital
            ? String(a.contenido || 'Sin documento digital en el portal.')
            : body || '(Sin contenido de documento)';
      for (const para of bodyText.replace(/\r\n/g, '\n').split('\n')) {
        const lines = wrap(doc, para || ' ', pageW - 28);
        for (const line of lines) {
          if (y > pageH - 40) {
            doc.addPage();
            drawBrandBar(doc, 'LegalMev — PDF único', pageW);
            y = 36;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...COLORS.text);
          }
          doc.text(line, 14, y);
          y += 12;
        }
      }
      y += 14;
    }

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`LegalMev · ${new Date().toLocaleString('es-AR')}`, 14, pageH - 16);
    return toBytes(doc);
  }

  function buildTextPdf(opts) {
    return buildActuacionPdf(
      {
        tipo: opts.title,
        descripcion: opts.subtitle,
        contenido: opts.body,
      },
      1,
      {}
    );
  }

  const api = { buildTextPdf, buildResumenPdf, buildActuacionPdf, buildMergedPdf, pieSeleccion };
  if (typeof window !== 'undefined') window.LegalMevPdfText = api;
  if (typeof self !== 'undefined') self.LegalMevPdfText = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
