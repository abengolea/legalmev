import type { ControlPruebaItem } from '@/types/control-prueba';
import { patchEstadoAudienciaPrueba } from '@/lib/control-prueba-audiencia-prueba';
import { patchEstadoDocumentalAutenticidad } from '@/lib/control-prueba-documental-autenticidad';
import { patchEstadoDocumentalEnPoder } from '@/lib/control-prueba-documental-poder';
import {
  esAudienciaOfrecida,
  usaEstadosProduccionPrueba,
} from '@/lib/control-prueba';
import {
  usaFlujoAutenticidadDocumental,
} from '@/lib/control-prueba-documental-autenticidad';
import { usaFlujoDocumentalEnPoder } from '@/lib/control-prueba-documental-poder';

/** Estados que cierran la prueba ofrecida (incluye a valoración judicial). */
export const ESTADOS_CIERRE_PRUEBA = [
  'producida',
  'valoracion_judicial',
  'desistida',
  'no_admitida',
] as const;

export type EstadoCierrePrueba = (typeof ESTADOS_CIERRE_PRUEBA)[number];

export function esCierrePrueba(estado: string): estado is EstadoCierrePrueba {
  return (ESTADOS_CIERRE_PRUEBA as readonly string[]).includes(estado);
}

/** Cuenta en el progreso «producida» del expediente (sin confundirse con producida real). */
export function cuentaComoProducidaEnProgreso(estado: string): boolean {
  return estado === 'producida' || estado === 'valoracion_judicial';
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Aplica limpieza de plazos y fecha de cierre al pasar a un estado terminal de prueba. */
export function patchCierrePrueba(
  item: ControlPruebaItem,
  patch: Partial<ControlPruebaItem>,
): Partial<ControlPruebaItem> {
  const estado = String(patch.estado ?? item.estado);
  if (!usaEstadosProduccionPrueba(item) || !esCierrePrueba(estado)) {
    return patch;
  }

  const result: Partial<ControlPruebaItem> = { ...patch };

  if (!item.fechaProduccion && !result.fechaProduccion) {
    result.fechaProduccion = hoyIso();
  }

  if (estado !== 'producida') {
    result.fechaLimite = null;
    result.fechaLimiteSecundaria = null;
  }

  return result;
}

/** Patch de estado para ítems de prueba ofrecida (todos los tipos). */
export function patchEstadoPruebaOfrecida(
  item: ControlPruebaItem,
  estado: string,
): Partial<ControlPruebaItem> {
  let patch: Partial<ControlPruebaItem> = { estado };

  if (usaFlujoDocumentalEnPoder(item)) {
    patch = patchEstadoDocumentalEnPoder(item, estado);
  } else if (usaFlujoAutenticidadDocumental(item)) {
    patch = patchEstadoDocumentalAutenticidad(item, estado);
  } else if (esAudienciaOfrecida(item)) {
    patch = patchEstadoAudienciaPrueba(item, estado);
  }

  return patchCierrePrueba(item, patch);
}

/** Detecta desistimiento de la prueba en texto de actuación / observaciones. */
export function constaDesistimientoPrueba(desc: string, obs?: string | null): boolean {
  const t = `${desc} ${obs ?? ''}`;
  return (
    /\bdesist(e|i|ió|imiento|e\s+de\s+la\s+prueba)\b/i.test(t) ||
    /\b(prueba|pericia|informe|documental).{0,40}desist/i.test(t) ||
    /\bse\s+tiene\s+por\s+desistid/i.test(t)
  );
}
