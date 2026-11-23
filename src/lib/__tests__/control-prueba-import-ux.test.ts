import { describe, expect, it } from 'vitest';
import {
  countItemsByParte,
  countItemsByTipo,
  formatControlPruebaQuotaCopy,
  importProgressMessage,
  pdfExtractErrorCopy,
  resolveImportStageStatuses,
} from '@/lib/control-prueba-import-ux';
import { formatControlPruebaQuotaExhaustedError } from '@/lib/control-prueba-access';

describe('resolveImportStageStatuses', () => {
  it('marca Cargar PDF en curso al inicio', () => {
    const statuses = resolveImportStageStatuses({
      hasFile: false,
      extracting: false,
      extracted: false,
      analyzing: false,
      hasPreview: false,
      reviewing: false,
      confirming: false,
    });
    expect(statuses.upload).toBe('current');
    expect(statuses.analyze).toBe('pending');
    expect(statuses.review).toBe('pending');
    expect(statuses.confirm).toBe('pending');
  });

  it('no da por analizado un PDF recién extraído', () => {
    const statuses = resolveImportStageStatuses({
      hasFile: true,
      extracting: false,
      extracted: true,
      analyzing: false,
      hasPreview: false,
      reviewing: false,
      confirming: false,
    });
    expect(statuses.upload).toBe('done');
    expect(statuses.analyze).toBe('current');
    expect(statuses.review).toBe('pending');
  });

  it('marca revisión en curso cuando hay preview', () => {
    const statuses = resolveImportStageStatuses({
      hasFile: true,
      extracting: false,
      extracted: true,
      analyzing: false,
      hasPreview: true,
      reviewing: true,
      confirming: false,
    });
    expect(statuses.analyze).toBe('done');
    expect(statuses.review).toBe('current');
    expect(statuses.confirm).toBe('pending');
  });

  it('marca confirmar en curso solo al guardar', () => {
    const statuses = resolveImportStageStatuses({
      hasFile: true,
      extracting: false,
      extracted: true,
      analyzing: false,
      hasPreview: true,
      reviewing: true,
      confirming: true,
    });
    expect(statuses.review).toBe('done');
    expect(statuses.confirm).toBe('current');
  });
});

describe('importProgressMessage', () => {
  it('aclara que extraer texto no usa IA', () => {
    const message = importProgressMessage({
      hasFile: true,
      extracting: true,
      extracted: false,
      analyzing: false,
      hasPreview: false,
      reviewing: false,
      confirming: false,
    });
    expect(message).toMatch(/no usa inteligencia artificial/i);
  });

  it('aclara que subir el PDF no alcanza', () => {
    const message = importProgressMessage({
      hasFile: true,
      extracting: false,
      extracted: true,
      analyzing: false,
      hasPreview: false,
      reviewing: false,
      confirming: false,
    });
    expect(message).toMatch(/subir el PDF no alcanza/i);
  });
});

describe('pdfExtractErrorCopy', () => {
  it('explica PDF escaneado sin jerga técnica', () => {
    const copy = pdfExtractErrorCopy('SCANNED_PDF');
    expect(copy.title).toMatch(/texto utilizable/i);
    expect(copy.recommendation).toMatch(/MEV o PJN/i);
    expect(copy.description).not.toMatch(/SCANNED_PDF/);
  });
});

describe('formatControlPruebaQuotaCopy', () => {
  it('no afirma renovación mensual si no hay fecha', () => {
    const copy = formatControlPruebaQuotaCopy({
      used: 2,
      limit: 5,
      remaining: 3,
      canCreate: true,
      monthlyResetAt: null,
    });
    expect(copy.renewalLine).toBeNull();
    expect(copy.usedLine).toMatch(/te quedan 3/);
  });

  it('incluye renovación solo con fecha válida', () => {
    const copy = formatControlPruebaQuotaCopy({
      used: 10,
      limit: 10,
      remaining: 0,
      canCreate: false,
      monthlyResetAt: '2026-12-01T00:00:00.000Z',
    });
    expect(copy.exhausted).toBe(true);
    expect(copy.renewalLine).toMatch(/Se renueva el/i);
  });
});

describe('formatControlPruebaQuotaExhaustedError', () => {
  it('no dice que se renueva cuando el cupo de registro no tiene fecha', () => {
    const message = formatControlPruebaQuotaExhaustedError({
      limit: 5,
      monthlyResetAt: null,
    });
    expect(message).toMatch(/5 controles de prueba/);
    expect(message).not.toMatch(/este mes/i);
    expect(message).not.toMatch(/renueva/i);
  });

  it('menciona renovación solo con monthlyResetAt', () => {
    const message = formatControlPruebaQuotaExhaustedError({
      limit: 10,
      monthlyResetAt: '2026-12-01T00:00:00.000Z',
    });
    expect(message).toMatch(/este mes/i);
    expect(message).toMatch(/renueva/i);
  });

  it('no afirma renovación con una fecha inválida', () => {
    const message = formatControlPruebaQuotaExhaustedError({
      limit: 5,
      monthlyResetAt: 'no-es-fecha',
    });
    expect(message).not.toMatch(/renueva/i);
    expect(message).not.toMatch(/este mes/i);
  });
});

describe('conteos de resultados', () => {
  it('agrupa por tipo y parte', () => {
    const items = [
      { tipo: 'documental', ofrecidaPor: 'actor' },
      { tipo: 'documental', ofrecidaPor: 'actor' },
      { tipo: 'testimonial', ofrecidaPor: 'demandado' },
    ];
    expect(countItemsByTipo(items)).toEqual([
      { tipo: 'documental', count: 2 },
      { tipo: 'testimonial', count: 1 },
    ]);
    expect(countItemsByParte(items)).toEqual([
      { parte: 'actor', count: 2 },
      { parte: 'demandado', count: 1 },
    ]);
  });
});
