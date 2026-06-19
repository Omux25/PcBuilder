import fs from 'fs';
import path from 'path';

// Vercel Edge caching config: Cache for 24 hours, stale-while-revalidate for 7 days
const CACHE_CONTROL = 's-maxage=86400, stale-while-revalidate=604800';

export default async function handler(req, res) {
  try {
    const url = req.url || '/';
    
    // Read the static index.html built by Vite
    // In Vercel serverless environment, the file path is relative to the function directory
    // However, depending on 'includeFiles', it's usually placed in the same relative path as the repo
    const indexPath = path.join(process.cwd(), 'apps', 'frontend', 'dist', 'index.html');
    
    let html = '';
    try {
      html = fs.readFileSync(indexPath, 'utf-8');
    } catch (e) {
      // Fallback if the file is at the root of the function deployment
      try {
        html = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf-8');
      } catch (err2) {
        try {
           html = fs.readFileSync(path.join(__dirname, '..', 'apps', 'frontend', 'dist', 'index.html'), 'utf-8');
        } catch (err3) {
          console.error("Could not find index.html", e);
          return res.status(500).send('Internal Server Error: Missing index.html. ' + e.message);
        }
      }
    }

    let title = "PC Builder Maroc — Comparateur de prix PC";
    let description = "Configurez votre PC, vérifiez la compatibilité et comparez les prix chez les meilleurs revendeurs au Maroc.";

    // Determine SEO tags based on route
    if (url.startsWith('/configurateur')) {
      title = "Configurateur | PC Builder Maroc";
      description = "Créez votre PC sur mesure avec notre configurateur intelligent. Vérifiez la compatibilité des composants et trouvez les meilleurs prix au Maroc.";
    } else if (url.startsWith('/composants')) {
      title = "Composants | PC Builder Maroc";
      description = "Parcourez et comparez tous les composants informatiques (Processeurs, Cartes Graphiques, Cartes Mères, etc.) au Maroc.";
    } else if (url.startsWith('/configurations')) {
      title = "Configurations | PC Builder Maroc";
      description = "Découvrez nos configurations PC optimisées pour le gaming, le travail ou le budget au Maroc.";
    } else if (url.startsWith('/comparer')) {
      title = "Comparateur | PC Builder Maroc";
      description = "Comparez les composants PC pour trouver la meilleure option pour votre configuration au Maroc.";
    } else if (url.startsWith('/parcourir/')) {
      const match = url.match(/\/parcourir\/([^\/?]+)/);
      if (match) {
        const cat = match[1];
        title = `${cat.toUpperCase()} | PC Builder Maroc`;
        description = `Parcourez et comparez les meilleurs ${cat} pour votre configuration PC au Maroc. Prix, spécifications et compatibilité.`;
      }
    } else if (url.startsWith('/composant/')) {
      // Dynamic Component Route
      const match = url.match(/\/composant\/([^\/?]+)/);
      if (match) {
        const slugOrId = match[1];
        try {
          // Identify if it's an ID (number) or slug
          let apiEndpoint = `https://pcbuilder-m2nf.onrender.com/api/components/slug/${slugOrId}`;
          if (/^\d+$/.test(slugOrId)) {
            apiEndpoint = `https://pcbuilder-m2nf.onrender.com/api/components/${slugOrId}`;
          }

          const apiRes = await fetch(apiEndpoint);
          if (apiRes.ok) {
            const comp = await apiRes.json();
            title = `${comp.name} - Prix au Maroc`;
            const brand = comp.brand ? ` ${comp.brand}` : '';
            description = `Achetez le composant${brand} ${comp.name} au meilleur prix au Maroc. Vérifiez la compatibilité et comparez les offres des revendeurs.`;
          }
        } catch (e) {
          console.error("Failed to fetch component for SEO:", e);
        }
      }
    }

    // Inject SEO tags into the HTML
    // We replace the hardcoded tags from index.html
    html = html.replace(/<title[^>]*>.*<\/title>/i, `<title>${title}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${description}"`);
    html = html.replace(/<meta property="og:title" content="[^"]*"/i, `<meta property="og:title" content="${title}"`);
    html = html.replace(/<meta property="og:description" content="[^"]*"/i, `<meta property="og:description" content="${description}"`);

    // Set headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    
    // Return the modified HTML
    res.send(html);
  } catch (error) {
    console.error("SEO Handler Error:", error);
    res.status(500).send("Internal Server Error");
  }
}
