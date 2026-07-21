import type { Metadata } from 'next';
import {
  SITE_URL as PUBLISHER_SITE_URL,
  PUBLISHER_LEGAL_NAME,
  PUBLISHER_CONTACT_EMAIL,
} from '@/lib/publisher-info';
import { SUPPORTED_PORTALS_SHORT } from '@/lib/supported-portals';

export const SITE_URL = PUBLISHER_SITE_URL;

export const SITE_NAME = 'LegalMev';

export const SITE_TAGLINE = 'Exportá expedientes judiciales a PDF';

export const SITE_DESCRIPTION =
  `LegalMev es la extensión de Chrome para abogados que exporta expedientes judiciales a PDF desde ${SUPPORTED_PORTALS_SHORT}. Descargas ilimitadas y gratis, más Copiloto de Audiencias y Control de pruebas con IA.`;

export const SITE_DESCRIPTION_SHORT =
  `Exportá expedientes a PDF desde ${SUPPORTED_PORTALS_SHORT}. Extensión Chrome para abogados — gratis e ilimitado.`;

/** Keywords orientadas a búsquedas reales (Google + descubrimiento por IA). */
export const SITE_KEYWORDS = [
  'LegalMev',
  'exportar expedientes a PDF',
  'descargar expediente judicial PDF',
  'extensión Chrome abogados',
  'MEV SCBA PDF',
  'Mesa de Entradas Virtual',
  'PJN descargar expediente',
  'Poder Judicial de la Nación PDF',
  'MPBA expedientes',
  'Poder Judicial Salta PDF',
  'Entre Ríos mesa virtual',
  'Tucumán SAE expediente',
  'copiloto de audiencias',
  'control de prueba IA',
  'software jurídico Argentina',
] as const;

export const LANDING_PATH = '/landing';

export const PUBLIC_PATHS = [
  { path: '/landing', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/landing/instrucciones', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/soporte', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/landing/bases-y-condiciones', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/landing/politica-privacidad', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/register', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/login', priority: 0.5, changeFrequency: 'yearly' as const },
] as const;

/** FAQs en texto plano para schema.org FAQPage (indexación Google + citas por IA). */
export const SEO_FAQS: { question: string; answer: string }[] = [
  {
    question: '¿Qué es LegalMev?',
    answer: `LegalMev es una extensión de Google Chrome y un servicio web para abogados en Argentina. Permite exportar expedientes judiciales completos a PDF desde ${SUPPORTED_PORTALS_SHORT}, con descargas ilimitadas y sin costo mensual.`,
  },
  {
    question: '¿En qué portales judiciales funciona LegalMev?',
    answer: `Funciona en MEV SCBA (Provincia de Buenos Aires), Portal del Poder Judicial de la Nación (PJN), Ministerio Público de la Provincia de Buenos Aires (MPBA), Poder Judicial de Salta, Mesa Virtual de Entre Ríos y Portal SAE de Tucumán. En Salta la búsqueda es pública y no hace falta login judicial.`,
  },
  {
    question: '¿Cuánto cuesta LegalMev?',
    answer:
      'La exportación de expedientes a PDF es gratuita e ilimitada para todos los usuarios registrados. Solo necesitás crear una cuenta y verificar tu email. Funciones premium con IA (Copiloto de Audiencias y Control de pruebas) incluyen créditos de prueba gratis.',
  },
  {
    question: '¿Cómo exporto un expediente a PDF?',
    answer:
      'Creá tu cuenta en legalmev.com.ar, verificá el email, instalá la extensión LegalMev en Chrome, conectala a tu cuenta, abrí el expediente en el portal judicial y exportá desde el ícono de la extensión. El PDF se descarga en tu computadora.',
  },
  {
    question: '¿LegalMev funciona en Firefox o Safari?',
    answer:
      'LegalMev está pensado para Google Chrome. En Edge u otros navegadores basados en Chromium puede funcionar, pero recomendamos Chrome para el mejor resultado.',
  },
  {
    question: '¿Qué es el Copiloto de Audiencias?',
    answer:
      'Es un asistente con IA de LegalMev para preparar y conducir audiencias: analiza el expediente, sugiere preguntas en vivo, detecta contradicciones y arma borradores de alegatos. Incluye 1 audiencia de prueba gratis al registrarte.',
  },
];

export function absoluteUrl(path = '/'): string {
  const base = SITE_URL.replace(/\/$/, '');
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(opts.path);
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title.includes(SITE_NAME) ? opts.title : `${opts.title} | ${SITE_NAME}`,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      locale: 'es_AR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
    },
    robots: opts.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    legalName: PUBLISHER_LEGAL_NAME,
    url: SITE_URL,
    email: PUBLISHER_CONTACT_EMAIL,
    description: SITE_DESCRIPTION_SHORT,
    areaServed: {
      '@type': 'Country',
      name: 'Argentina',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: PUBLISHER_CONTACT_EMAIL,
      contactType: 'customer support',
      availableLanguage: ['Spanish'],
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Legal software',
    operatingSystem: 'Chrome, Chromium',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'ARS',
      description: 'Exportación de expedientes a PDF gratuita e ilimitada',
    },
    description: SITE_DESCRIPTION,
    url: absoluteUrl(LANDING_PATH),
    inLanguage: 'es-AR',
    featureList: [
      `Exportación de expedientes a PDF (${SUPPORTED_PORTALS_SHORT})`,
      'Extensión para Google Chrome',
      'Copiloto de Audiencias con IA',
      'Control de pruebas con IA',
      'Descargas ilimitadas sin suscripción',
    ],
    publisher: {
      '@type': 'Organization',
      name: PUBLISHER_LEGAL_NAME,
      url: SITE_URL,
    },
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION_SHORT,
    inLanguage: 'es-AR',
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };
}

export function faqPageJsonLd(faqs: { question: string; answer: string }[] = SEO_FAQS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
