import { permanentRedirect } from 'next/navigation';

/** La home canónica de marketing es /landing (SEO + sitemap). */
export default function RootPage() {
  permanentRedirect('/landing');
}
