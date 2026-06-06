import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';

const app = new Hono();
app.use('/admin/*', serveStatic({ 
  root: './admin/dist',
  rewriteRequestPath: (path) => {
    const newPath = path.replace(/^\/admin/, '');
    console.log('rewriting', path, '->', newPath);
    return newPath;
  }
}));

Bun.serve({ port: 3001, fetch: app.fetch });
console.log('Server running on 3001');
