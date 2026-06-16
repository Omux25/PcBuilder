export default async function handler(req, res) {
  // Determine the host for fetching the base HTML
  const host = req.headers.host || process.env.VERCEL_URL || 'pcbuilder.ma';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  
  try {
    // 1. Fetch the original index.html from the deployment
    // We append a timestamp to bust the edge cache and get the raw file
    const htmlResponse = await fetch(`${protocol}://${host}/?_bypasseo=1`);
    if (!htmlResponse.ok) {
      throw new Error(`Failed to fetch index.html: ${htmlResponse.statusText}`);
    }
    let html = await htmlResponse.text();
    
    // 2. Fetch data based on the requested path
    const path = req.query.path || '';
    
    let title = 'PC Builder Maroc — Comparateur de prix PC';
    let description = 'Configurez votre PC, vérifiez la compatibilité et comparez les prix chez les revendeurs marocains.';
    let image = 'https://pcbuilder.ma/premium_pc_hero.png';

    // Handle Component Detail pages
    if (path.startsWith('/component/')) {
       const id = path.split('/')[2];
       if (id) {
         // Fetch component from your Render backend
         const backendRes = await fetch(`https://pcbuilder-m2nf.onrender.com/api/components/${id}`);
         if (backendRes.ok) {
             const component = await backendRes.json();
             title = `${component.name} - Prix et Specs Maroc | PC Builder`;
             description = `Achetez ${component.name} au meilleur prix au Maroc. Compatible avec votre configuration PC Gamer.`;
             if (component.image_url) {
               image = component.image_url;
             }
         }
       }
    } 
    // Handle Presets page
    else if (path.startsWith('/presets')) {
       title = 'Configurations PC Gamer & Workstation - PC Builder Maroc';
       description = 'Découvrez nos configurations optimisées pour le gaming, le travail ou le budget. Trouvez le PC parfait pour vos besoins au Maroc.';
    }

    // 3. Inject meta tags using Regex replacement
    // Replace <title>
    html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
    
    // Replace <meta name="description">
    html = html.replace(
      /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i, 
      `<meta name="description" content="${description}" />`
    );
    
    // Replace <meta property="og:title">
    html = html.replace(
      /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i, 
      `<meta property="og:title" content="${title}" />`
    );
    
    // Replace <meta property="og:description">
    html = html.replace(
      /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/i, 
      `<meta property="og:description" content="${description}" />`
    );
    
    // Replace <meta property="og:image">
    html = html.replace(
      /<meta\s+property=["']og:image["']\s+content=["'][^"']*["']\s*\/?>/i, 
      `<meta property="og:image" content="${image}" />`
    );

    // Set headers to cache the response at the edge for 1 hour, revalidate after 24h
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    
    return res.status(200).send(html);

  } catch (err) {
    console.error('SEO Error:', err);
    // Fallback: If anything fails, redirect to the path directly so the SPA can handle it
    res.redirect(307, req.query.path || '/');
  }
}
