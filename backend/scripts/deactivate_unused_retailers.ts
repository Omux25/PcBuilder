import { sql } from 'bun';

const result = await sql`
  UPDATE retailers SET is_active = false
  WHERE name IN ('Matelpro', 'Tradeline', 'Mytek', 'Wiki', 'Tunisianet', 'Electro Bazar')
  RETURNING name
` as { name: string }[];

if (result.length === 0) {
  console.log('Aucun revendeur à désactiver (déjà désactivés ou inexistants).');
} else {
  console.log('Revendeurs désactivés:', result.map((r) => r.name).join(', '));
}

const active = await sql`SELECT name FROM retailers WHERE is_active = true ORDER BY name` as { name: string }[];
console.log('Revendeurs actifs:', active.map((r) => r.name).join(', '));
