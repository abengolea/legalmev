import { describe, expect, it } from 'vitest';
import { mergeTestigosConIdentificados, normalizeNombreDeclarante, seedAnalisisDesdeIdentificados } from '@/lib/audiencia-merge-testigos';
import type { AudienciaTestigo } from '@/lib/audiencia-session-types';

function testigo(partial: Partial<AudienciaTestigo> & Pick<AudienciaTestigo, 'nombre'>): AudienciaTestigo {
  return {
    id: partial.id ?? `id-${partial.nombre}`,
    nombre: partial.nombre,
    rol: partial.rol ?? 'Testigo',
    bandeja: partial.bandeja ?? 'indefinida',
    contextoDeclarante: partial.contextoDeclarante ?? '',
    testimonioPrevio: partial.testimonioPrevio ?? '',
    intercambios: partial.intercambios ?? [],
    testimonioCerrado: partial.testimonioCerrado ?? false,
  };
}

describe('mergeTestigosConIdentificados', () => {
  it('normaliza nombres con acentos y mayúsculas', () => {
    expect(normalizeNombreDeclarante('  JOSÉ  Pérez ')).toBe('jose perez');
  });

  it('completa contexto de testigos existentes sin crear duplicados', () => {
    const existing = [
      testigo({ nombre: 'Juan Perez', rol: 'Testigo' }),
      testigo({ nombre: 'Maria Gomez', contextoDeclarante: 'Ya anotado por el abogado' }),
    ];

    const result = mergeTestigosConIdentificados({
      existing,
      identified: [
        {
          nombre: 'Juan Pérez',
          rol: 'Vecino',
          relevancia: 'Vio quién estaba el día del hecho.',
          parteProcesal: 'actor',
        },
        {
          nombre: 'María Gómez',
          rol: 'Empleada',
          relevancia: 'No debería pisar el contexto ya cargado.',
          parteProcesal: 'demandado',
        },
      ],
      declaracionesPrevias: [],
      representacion: { parte: 'actor', clienteNombre: '', notas: '' },
      tipoFuero: 'civil',
    });

    expect(result.testigos).toHaveLength(2);
    expect(result.agregados).toBe(0);
    expect(result.testigos[0].contextoDeclarante).toBe('Vio quién estaba el día del hecho.');
    expect(result.testigos[0].rol).toBe('Vecino');
    expect(result.testigos[1].contextoDeclarante).toBe('Ya anotado por el abogado');
  });

  it('agrega declarantes que solo aparecen en el contexto extra', () => {
    const existing = [testigo({ nombre: 'Juan Perez' })];

    const result = mergeTestigosConIdentificados({
      existing,
      identified: [
        {
          nombre: 'Juan Perez',
          rol: 'Testigo',
          relevancia: 'Ya estaba.',
          parteProcesal: 'actor',
        },
        {
          nombre: 'Ana Lopez',
          rol: 'Perito',
          relevancia: 'Pericia mecánica.',
          parteProcesal: 'neutro',
        },
      ],
      declaracionesPrevias: [],
      representacion: { parte: 'actor', clienteNombre: '', notas: '' },
      tipoFuero: 'civil',
      maxTestigos: 10,
    });

    expect(result.testigos).toHaveLength(2);
    expect(result.agregados).toBe(1);
    expect(result.idsAgregados).toHaveLength(1);
    expect(result.testigos[1].nombre).toBe('Ana Lopez');
    expect(result.testigos[1].contextoDeclarante).toBe('Pericia mecánica.');
  });

  it('respeta el tope y no borra testigos con preguntas', () => {
    const existing = [
      testigo({
        nombre: 'A',
        intercambios: [{ id: '1', pregunta: '¿?', respuesta: 'sí' }],
      }),
    ];

    const result = mergeTestigosConIdentificados({
      existing,
      identified: [
        { nombre: 'B', rol: 'Testigo', relevancia: 'Nuevo', parteProcesal: 'actor' },
        { nombre: 'C', rol: 'Testigo', relevancia: 'Otro', parteProcesal: 'actor' },
      ],
      declaracionesPrevias: [],
      representacion: { parte: 'actor', clienteNombre: '', notas: '' },
      tipoFuero: 'civil',
      maxTestigos: 1,
    });

    expect(result.testigos).toHaveLength(1);
    expect(result.testigos[0].nombre).toBe('A');
    expect(result.testigos[0].intercambios).toHaveLength(1);
    expect(result.agregados).toBe(0);
  });
});

describe('seedAnalisisDesdeIdentificados', () => {
  it('carga las preguntas sugeridas en el análisis de cada testigo', () => {
    const existing = [testigo({ id: 't1', nombre: 'Ana Lopez' })];
    const analysis = seedAnalisisDesdeIdentificados({
      testigos: existing,
      identified: [
        {
          nombre: 'Ana López',
          rol: 'Perito',
          relevancia: 'Pericia mecánica.',
          parteProcesal: 'neutro',
          preguntasSugeridas: [
            '¿Qué metodología usó para la pericia?',
            '¿Revisó el vehículo el mismo día del hecho?',
          ],
        },
      ],
      analysisByTestigoId: {},
    });

    expect(analysis.t1.repreguntas).toHaveLength(2);
    expect(analysis.t1.repreguntas[0].texto).toContain('metodología');
  });
});
