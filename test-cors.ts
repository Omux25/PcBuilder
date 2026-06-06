import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('*', cors({
  origin: '*',
  credentials: true,
}));

app.get('/', (c) => c.text('ok'));

const req = new Request('http://localhost/', {
  headers: {
    Origin: 'https://pcbuilder.ma'
  }
});

const res = await app.fetch(req);
console.log('Headers:');
for (const [k, v] of res.headers.entries()) {
  console.log(`${k}: ${v}`);
}
