import { describe, expect, it } from 'vitest';
import type { ControlPruebaItem } from '@/types/control-prueba';
import {
  ensureVinculosConstatacionJudicialDocumental,
  inferirModoConstatacionJudicial,
  inferirResolucionAutenticidadDocumental,
  repararAutenticidadDocumentalSubprocesos,
} from '@/lib/control-prueba-constatacion-judicial';
import { oficiosAutenticidadDeDocumental } from '@/lib/control-prueba-subprocesos';

function documentalWebImpugnada(): ControlPruebaItem {
  return {
    id: 'doc-web',
    orden: 1,
    categoria: 'prueba',
    tipo: 'documental',
    descripcion: 'Captura de página web del portal X',
    ofrecidaPor: 'actor',
    estado: 'autenticidad_impugnada',
    observaciones: 'Demandado niega autenticidad; actor ofrece constatación por el actuario',
    documental: { autenticidadImpugnada: true },
  };
}

describe('constatacion judicial', () => {
  it('infiera constatación para web + actuario', () => {
    const doc = documentalWebImpugnada();
    expect(inferirResolucionAutenticidadDocumental(doc)).toBe('constatacion_judicial');
    expect(inferirModoConstatacionJudicial(doc)).toBe('directa');
  });

  it('crea constatación vinculada y no oficio externo', () => {
    const doc = documentalWebImpugnada();
    const oficioErroneo: ControlPruebaItem = {
      id: 'of-bad',
      orden: 2,
      categoria: 'diligencia',
      tipo: 'oficio',
      descripcion: 'Oficio autenticidad',
      ofrecidaPor: 'actor',
      estado: 'pendiente',
      vinculo: {
        parentItemId: doc.id,
        parentTipo: 'documental',
        parentCategoria: 'prueba',
        rol: 'oficio_autenticidad',
        autoCreated: true,
        vinculoLabel: 'Oficio',
        triggerKey: 'x',
      },
      diligencia: { pruebaVinculadaId: doc.id, destinatario: 'Actuario' },
    };
    const items = repararAutenticidadDocumentalSubprocesos([doc, oficioErroneo]);
    expect(oficiosAutenticidadDeDocumental(items, doc.id)).toHaveLength(0);
    const r = ensureVinculosConstatacionJudicialDocumental(items, doc.id);
    const constat = r.items.filter((i) => i.tipo === 'constatacion_judicial');
    expect(constat).toHaveLength(1);
    expect(constat[0]?.vinculo?.rol).toBe('constatacion_judicial_vinculada');
  });

  it('modo delegada crea mandamiento', () => {
    const doc: ControlPruebaItem = {
      ...documentalWebImpugnada(),
      observaciones: 'Se libra mandamiento al juez delegado en San Isidro para constatación de la página web',
    };
    const r = ensureVinculosConstatacionJudicialDocumental([doc], doc.id);
    expect(r.items.some((i) => i.tipo === 'mandamiento' && i.vinculo?.rol === 'mandamiento_constatacion')).toBe(
      true,
    );
  });
});
