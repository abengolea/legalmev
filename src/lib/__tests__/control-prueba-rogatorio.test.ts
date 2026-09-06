import { describe, expect, it } from 'vitest';
import type { ControlPruebaItem } from '@/types/control-prueba';
import {
  crearRogatorioLey22172,
  esOficioLey22172,
  esTramiteSedeRogatoria,
  oficiosLey22172DePadre,
  patchMarcarRogatorio,
  syncMadreTrasHitoRogatorio,
  tramitesSedeDePadre,
} from '@/lib/control-prueba-rogatorio';

function madrePericial(): ControlPruebaItem {
  return {
    id: 'madre-1',
    orden: 1,
    categoria: 'prueba',
    tipo: 'pericial',
    descripcion: 'Pericial contable',
    ofrecidaPor: 'actor',
    estado: 'pendiente_produccion',
    pericial: { especialidad: 'contable', extrañaJurisdiccion: true },
  };
}

describe('rogatorio Ley 22.172', () => {
  it('crea oficio + trámite 1:1 bajo la madre', () => {
    const madre = madrePericial();
    const { items, oficio, tramite } = crearRogatorioLey22172([madre], madre.id, {
      destinatario: 'Juez Comercial turno CABA',
    });
    expect(oficio).toBeTruthy();
    expect(tramite).toBeTruthy();
    expect(esOficioLey22172(oficio!)).toBe(true);
    expect(esTramiteSedeRogatoria(tramite!)).toBe(true);
    expect(tramite!.rogatorio?.oficioId).toBe(oficio!.id);
    expect(oficio!.vinculo?.parentItemId).toBe(madre.id);
    expect(tramite!.vinculo?.parentItemId).toBe(madre.id);
    expect(oficiosLey22172DePadre(items, madre.id)).toHaveLength(1);
    expect(tramitesSedeDePadre(items, madre.id)).toHaveLength(1);
  });

  it('permite N pares (Córdoba y Santa Fe)', () => {
    const madre = madrePericial();
    const r1 = crearRogatorioLey22172([madre], madre.id, { destinatario: 'Juez Córdoba' });
    const r2 = crearRogatorioLey22172(r1.items, madre.id, { destinatario: 'Juez Santa Fe' });
    expect(oficiosLey22172DePadre(r2.items, madre.id)).toHaveLength(2);
    expect(tramitesSedeDePadre(r2.items, madre.id)).toHaveLength(2);
  });

  it('no crea si el flag no está marcado', () => {
    const madre = { ...madrePericial(), pericial: { especialidad: 'contable', extrañaJurisdiccion: false } };
    const r = crearRogatorioLey22172([madre], madre.id);
    expect(r.oficio).toBeNull();
  });

  it('al completar remisión empuja madre a dictamen_presentado', () => {
    const madre = madrePericial();
    const { items, tramite } = crearRogatorioLey22172([madre], madre.id, {
      destinatario: 'Juez CABA',
    });
    const hitos = (tramite!.rogatorio!.hitos ?? []).map((h) =>
      h.id === 'remitido' ? { ...h, completada: true, fecha: '2026-01-15' } : h,
    );
    const next = syncMadreTrasHitoRogatorio(items, tramite!.id, hitos);
    expect(next.find((i) => i.id === madre.id)?.estado).toBe('dictamen_presentado');
    expect(next.find((i) => i.id === tramite!.id)?.estado).toBe('remitido');
  });

  it('patchMarcarRogatorio en confesional', () => {
    const item: ControlPruebaItem = {
      id: 'c1',
      orden: 1,
      categoria: 'prueba',
      tipo: 'confesional',
      descripcion: 'Confesional',
      estado: 'pendiente_produccion',
    };
    const patch = patchMarcarRogatorio(item, true);
    expect(patch.audienciaPrueba?.extrañaJurisdiccion).toBe(true);
  });
});
