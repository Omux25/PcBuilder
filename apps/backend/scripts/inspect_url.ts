// apps/backend/scripts/inspect_url.ts
import { inferCategory, inferCategoryFromUrl } from '@shared/hardware/categories';

const urls = [
  'https://nextlevelpc.ma/composants/78870-hybrok-hl360b-noir.html',
  'https://www.ultrapc.ma/boitier-pc/7938-xtrmlab-xh100-hub.html'
];

for (const url of urls) {
  const name = url.split('/').pop()?.replace('.html', '').replace(/-/g, ' ') || '';
  console.log(`URL: ${url}`);
  console.log(`Extracted Name: "${name}"`);
  console.log(`Infer from Name: ${inferCategory(name)}`);
  console.log(`Infer from URL: ${inferCategoryFromUrl(url)}`);
  console.log('---');
}
