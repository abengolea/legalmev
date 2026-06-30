import type { ControlPruebaItem, ItemCategoria } from '@/types/control-prueba';
import { diasHabilesHasta, plazoSugeridoDiasHabiles, etiquetaDiasHabiles } from '@/lib/control-prueba-plazos';
import { PARTE_LABELS, resolveCategoria, TIPO_LABELS } from '@/lib/control-prueba';
import {
  estadosTerminalesComunicacion,
  usaEstadosComunicacionEspeciales,
} from '@/lib/control-prueba-cedula-notif';
import { ESTADOS_CIERRE_PRUEBA } from '@/lib/control-prueba-cierre';

export type AlertaNivel = 'rojo' | 'amarillo' | 'verde' | 'gris';

export type ControlPruebaAlerta = {
  itemId: string;
  orden: number;
  categoria: ItemCategoria;
  tipo: string;
  tipoLabel: string;
  descripcion: string;
  ofrecidaPor?: string;
  estado: string;
  fechaLimite: string;
  diasHabiles: number | null;
  nivel: AlertaNivel;
  mensaje: string;
};

export type ResumenAlertas = {
  rojo: number;
  amarillo: number;
  verde: number;
  gris: number;
  totalRiesgo: number;
};

const UMBRAL_ROJO = 3;
const UMBRAL_AMARILLO = 10;

const ESTADOS_TERMINALES: Record<ItemCategoria, readonly string[]> = {
  prueba: [...ESTADOS_CIERRE_PRUEBA],
  diligencia: ['cumplido'],
  audiencia: ['realizada', 'cancelada'],
  tramite: ['resuelta_admitida', 'resuelta_rechazada', 'cumplida'],
  mejor_proveer: ['cumplida', 'dispensada', 'incumplida'],
};

function itemRequiereSeguimiento(item: ControlPruebaItem): boolean {
  const cat = resolveCategoria(item);
  if (usaEstadosComunicacionEspeciales(item)) {
    return !estadosTerminalesComunicacion(item).includes(String(item.estado));
  }
  const terminales = ESTADOS_TERMINALES[cat];
  return !terminales.includes(String(item.estado));
}

export function evaluarNivelAlerta(diasHabiles: number | null, tieneFecha: boolean): AlertaNivel {
  if (!tieneFecha || diasHabiles === null) return 'gris';
  if (diasHabiles < 0 || diasHabiles <= UMBRAL_ROJO) return 'rojo';
  if (diasHabiles <= UMBRAL_AMARILLO) return 'amarillo';
  return 'verde';
}

export function evaluarAlertaItem(item: ControlPruebaItem, ahora = new Date()): ControlPruebaAlerta | null {
  const categoria = resolveCategoria(item);
  if (!itemRequiereSeguimiento(item)) return null;

  const fechaLimite = item.fechaLimite?.trim();
  if (!fechaLimite) {
    const sugerido = plazoSugeridoDiasHabiles(item.tipo);
    if (sugerido && categoria === 'prueba' && ['pericial', 'informativa'].includes(item.tipo)) {
      return {
        itemId: item.id,
        orden: item.orden,
        categoria,
        tipo: item.tipo,
        tipoLabel: TIPO_LABELS[item.tipo] ?? item.tipo,
        descripcion: item.descripcion,
        ofrecidaPor: item.ofrecidaPor,
        estado: String(item.estado),
        fechaLimite: '',
        diasHabiles: null,
        nivel: 'gris',
        mensaje: `Sin fecha límite — plazo orientativo CPCC: ${sugerido} días hábiles (${TIPO_LABELS[item.tipo] ?? item.tipo})`,
      };
    }
    return null;
  }

  const dias = diasHabilesHasta(fechaLimite, ahora);
  const nivel = evaluarNivelAlerta(dias, true);
  const prefijo =
    categoria === 'audiencia'
      ? 'Audiencia'
      : categoria === 'diligencia'
        ? 'Diligencia'
        : categoria === 'mejor_proveer'
          ? 'Medida'
          : 'Prueba';

  return {
    itemId: item.id,
    orden: item.orden,
    categoria,
    tipo: item.tipo,
    tipoLabel: TIPO_LABELS[item.tipo] ?? item.tipo,
    descripcion: item.descripcion,
    ofrecidaPor: item.ofrecidaPor,
    estado: String(item.estado),
    fechaLimite,
    diasHabiles: dias,
    nivel,
    mensaje: `${prefijo} #${item.orden}: ${etiquetaDiasHabiles(dias)}`,
  };
}

export function listarAlertasItems(items: ControlPruebaItem[], ahora = new Date()): ControlPruebaAlerta[] {
  const alertas = items
    .map((item) => evaluarAlertaItem(item, ahora))
    .filter((a): a is ControlPruebaAlerta => a !== null);

  const ordenNivel: Record<AlertaNivel, number> = { rojo: 0, amarillo: 1, verde: 2, gris: 3 };
  return alertas.sort((a, b) => {
    const dn = ordenNivel[a.nivel] - ordenNivel[b.nivel];
    if (dn !== 0) return dn;
    const da = a.diasHabiles ?? 999;
    const db = b.diasHabiles ?? 999;
    return da - db;
  });
}

export function resumirAlertas(alertas: ControlPruebaAlerta[]): ResumenAlertas {
  const res: ResumenAlertas = { rojo: 0, amarillo: 0, verde: 0, gris: 0, totalRiesgo: 0 };
  for (const a of alertas) {
    res[a.nivel] += 1;
    if (a.nivel === 'rojo' || a.nivel === 'amarillo') res.totalRiesgo += 1;
  }
  return res;
}

export const ALERTA_NIVEL_CONFIG: Record<
  AlertaNivel,
  { label: string; dotClass: string; bgClass: string; borderClass: string; textClass: string }
> = {
  rojo: {
    label: 'Crítico',
    dotClass: 'bg-red-500',
    bgClass: 'bg-red-50 dark:bg-red-950/30',
    borderClass: 'border-red-300 dark:border-red-800',
    textClass: 'text-red-900 dark:text-red-200',
  },
  amarillo: {
    label: 'Próximo',
    dotClass: 'bg-amber-500',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    borderClass: 'border-amber-300 dark:border-amber-800',
    textClass: 'text-amber-900 dark:text-amber-200',
  },
  verde: {
    label: 'En plazo',
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/20',
    borderClass: 'border-emerald-300 dark:border-emerald-800',
    textClass: 'text-emerald-900 dark:text-emerald-200',
  },
  gris: {
    label: 'Sin fecha',
    dotClass: 'bg-slate-400',
    bgClass: 'bg-slate-50 dark:bg-slate-900/30',
    borderClass: 'border-slate-200 dark:border-slate-700',
    textClass: 'text-slate-700 dark:text-slate-300',
  },
};

export function parteLabel(ofrecidaPor?: string): string {
  if (!ofrecidaPor) return '';
  return PARTE_LABELS[ofrecidaPor] ?? ofrecidaPor;
}
