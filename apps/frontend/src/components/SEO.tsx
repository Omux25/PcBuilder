import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title: string;
  description: string;
  name?: string;
  type?: string;
  image?: string;
  url?: string;
}

export function SEO({
  title,
  description,
  name = 'PC Builder Maroc',
  type = 'website',
  image = 'https://pcbuilder.ma/premium_pc_hero.png', // Default image from public directory
  url,
  schema, // Optional JSON-LD schema
}: SEOProps & { schema?: Record<string, any> }) {
  const location = useLocation();
  const canonicalUrl = url || `https://pcbuilder.ma${location.pathname}`;
  const fullTitle = title.includes(name) ? title : `${title} | ${name}`;

  // Default Organization schema if none provided
  const defaultSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PC Builder Maroc',
    url: 'https://pcbuilder.ma',
    logo: 'https://pcbuilder.ma/favicon-pc.png',
    description: 'Le premier comparateur de prix de composants PC et configurateur sur mesure au Maroc.',
    sameAs: [
      'https://www.instagram.com/pcbuilder.ma' // Add real social links here if any
    ]
  };

  const finalSchema = schema || defaultSchema;

  return (
    <Helmet>
      {/* Canonical URL for SEO */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(finalSchema)}
      </script>
      
      {/* Standard metadata tags */}
      <title>{fullTitle}</title>
      <meta name='description' content={description} />
      
      {/* Facebook tags */}
      <meta property='og:type' content={type} />
      <meta property='og:title' content={fullTitle} />
      <meta property='og:description' content={description} />
      <meta property='og:url' content={canonicalUrl} />
      <meta property='og:image' content={image} />
      <meta property='og:site_name' content={name} />
      
      {/* Twitter tags */}
      <meta name='twitter:creator' content={name} />
      <meta name='twitter:card' content='summary_large_image' />
      <meta name='twitter:title' content={fullTitle} />
      <meta name='twitter:description' content={description} />
      <meta name='twitter:image' content={image} />
    </Helmet>
  );
}
