import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

/**
 * robots.txt orientado a Google + crawlers de IA.
 * Indexa marketing/docs; bloquea paneles privados y APIs.
 */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = [
    '/api/',
    '/dashboard',
    '/dashboard/',
    '/admin',
    '/admin/',
    '/cases',
    '/cases/',
    '/settings',
    '/extension-connect',
    '/esperando-aprobacion',
    '/verifica-email',
    '/auth/',
    '/forgot-password',
  ];

  const aiAllow = [
    '/',
    '/landing',
    '/landing/',
    '/soporte',
    '/register',
    '/login',
    '/llms.txt',
    '/sitemap.xml',
    '/humans.txt',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: privatePaths,
      },
      {
        userAgent: 'GPTBot',
        allow: aiAllow,
        disallow: privatePaths,
      },
      {
        userAgent: 'ChatGPT-User',
        allow: aiAllow,
        disallow: privatePaths,
      },
      {
        userAgent: 'ClaudeBot',
        allow: aiAllow,
        disallow: privatePaths,
      },
      {
        userAgent: 'Anthropic-AI',
        allow: aiAllow,
        disallow: privatePaths,
      },
      {
        userAgent: 'Google-Extended',
        allow: aiAllow,
        disallow: privatePaths,
      },
      {
        userAgent: 'PerplexityBot',
        allow: aiAllow,
        disallow: privatePaths,
      },
      {
        userAgent: 'Applebot-Extended',
        allow: aiAllow,
        disallow: privatePaths,
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
