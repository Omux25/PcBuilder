const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');
const assetsDir = path.join(distDir, 'assets');

try {
  let html = fs.readFileSync(indexPath, 'utf-8');
  const files = fs.readdirSync(assetsDir);
  const cssFiles = files.filter(f => f.endsWith('.css'));

  let combinedCss = '';
  for (const file of cssFiles) {
    const cssPath = path.join(assetsDir, file);
    combinedCss += fs.readFileSync(cssPath, 'utf-8');
    
    // Replace the link tag for this specific CSS file
    const linkRegex = new RegExp(`<link[^>]*href="/assets/${file}"[^>]*>`, 'g');
    html = html.replace(linkRegex, '');
  }

  // Insert combined CSS into head
  html = html.replace('</head>', `<style>${combinedCss}</style></head>`);
  
  fs.writeFileSync(indexPath, html);
  console.log('CSS inlined successfully! Render blocking eliminated.');
} catch (error) {
  console.error('Error inlining CSS:', error);
  process.exit(1);
}
