import { sql } from 'bun';
const r = await sql`SELECT COUNT(*)::int as cnt FROM preset_builds WHERE is_active = true`;
console.log('Active presets:', (r as any)[0].cnt);
const comps = await sql`SELECT COUNT(*)::int as cnt FROM preset_build_components`;
console.log('Preset components:', (comps as any)[0].cnt);
process.exit(0);
