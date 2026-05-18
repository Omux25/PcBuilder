import { getSql } from '../core/db/index.js';

interface PresetConfig {
  name: string;
  description: string;
  use_case: 'gaming' | 'workstation' | 'budget';
  is_featured: boolean;
  components: {
    cpu: string;
    gpu?: string;
    motherboard: string;
    ram: string;
    storage: string;
    psu: string;
    case: string;
    cooling?: string;
  };
}

const MOROCCAN_PRESETS: PresetConfig[] = [
  {
    name: 'Atlas Spark',
    description: 'La meilleure configuration pour débuter en 1080p. Performance stable et prix imbattable pour le marché marocain.',
    use_case: 'budget',
    is_featured: false,
    components: {
      cpu: 'Ryzen 5 5500',
      gpu: 'RTX 4060',
      motherboard: 'Prime B550M-K',
      ram: '16GB 3200',
      storage: 'P300',
      psu: '550W 80Plus',
      case: 'Master Mb511',
      cooling: 'Ag400'
    }
  },
  {
    name: 'Oasis Horizon',
    description: 'Le "Sweet Spot" du gaming au Maroc. Rapport performance/prix imbattable avec 20GB de VRAM pour le futur.',
    use_case: 'gaming',
    is_featured: true,
    components: {
      cpu: 'Ryzen 5 7600',
      gpu: 'RX 7900 XT',
      motherboard: 'B650M D3Hp Ax',
      ram: '32GB DDR5',
      storage: '1To  NVMe',
      psu: '750W 80Plus Gold',
      case: 'H5 Flow',
      cooling: 'Ag400'
    }
  },
  {
    name: 'Atlantic Zenith',
    description: 'Configuration Elite pour le 4K. Le processeur gaming le plus rapide du monde combiné à la puissance de NVIDIA.',
    use_case: 'gaming',
    is_featured: true,
    components: {
      cpu: 'Ryzen 7 7800X3D',
      gpu: 'RTX 4080 Super',
      motherboard: 'X670E',
      ram: 'Thor RGB 32GB',
      storage: '1To  NVMe',
      psu: '850W 80Plus Gold',
      case: 'H9 Elite',
      cooling: 'Kraken Plus 360'
    }
  },
  {
    name: 'Casablanca Infinite',
    description: 'Station de travail pour créateurs. Optimisée pour le montage 4K, le rendu 3D et le streaming.',
    use_case: 'workstation',
    is_featured: true,
    components: {
      cpu: '14900K',
      gpu: 'RTX 4070 Ti Super',
      motherboard: 'Z790',
      ram: 'Ares RGB 32GB',
      storage: '1To  NVMe',
      psu: 'Rm1000E',
      case: '5000D Airflow',
      cooling: 'Titan 360 RX'
    }
  },
  {
    name: 'Rif Nexus',
    description: 'Optimisée pour les développeurs et la data science. Puissance multicœur massive et RAM généreuse.',
    use_case: 'workstation',
    is_featured: false,
    components: {
      cpu: 'Ryzen 9 7900X',
      gpu: 'RTX 3060',
      motherboard: 'B650M D3Hp Ax',
      ram: 'Thor RGB 32GB',
      storage: '1To  NVMe',
      psu: '750W 80Plus Gold',
      case: 'Be Quiet Pure Base',
      cooling: 'Ag620'
    }
  }
];

async function findComponent(category: string, query: string) {
  const sql = getSql();
  const results = await sql`
    SELECT c.id, c.name FROM components c
    WHERE c.category = ${category} 
    AND c.name ILIKE ${'%' + query + '%'}
    AND c.is_active = true
    AND EXISTS (
      SELECT 1 FROM prices p 
      WHERE p.component_id = c.id 
      AND p.in_stock = true
    )
    ORDER BY 
      CASE WHEN c.name ILIKE ${query} THEN 0 ELSE 1 END,
      LENGTH(c.name) ASC,
      c.id ASC
    LIMIT 1
  `;
  return (results[0] as any)?.id;
}

async function seed() {
  const sql = getSql();
  console.log('--- SEEDING MOROCCAN PREBUILDS ---');

  for (const config of MOROCCAN_PRESETS) {
    console.log(`Processing: ${config.name}...`);
    
    const componentIds: Record<string, number> = {};
    for (const [cat, query] of Object.entries(config.components)) {
      const id = await findComponent(cat, query);
      if (id) {
        componentIds[cat] = id;
      } else {
        console.warn(`  [WARN] Could not find in-stock ${cat} matching "${query}"`);
      }
    }

    if (Object.keys(componentIds).length === 0) {
      console.error(`  [ERROR] No components found for ${config.name}. Skipping.`);
      continue;
    }

    await sql.begin(async (tx) => {
      // Clear existing with same name to avoid duplicates during testing
      await tx`DELETE FROM preset_build_components WHERE preset_build_id IN (SELECT id FROM preset_builds WHERE name = ${config.name})`;
      await tx`DELETE FROM preset_builds WHERE name = ${config.name}`;

      const [preset] = (await tx`
        INSERT INTO preset_builds (name, description, use_case, is_active, is_featured)
        VALUES (${config.name}, ${config.description}, ${config.use_case}, true, ${config.is_featured})
        RETURNING id
      `) as any[];

      for (const [cat, id] of Object.entries(componentIds)) {
        await tx`
          INSERT INTO preset_build_components (preset_build_id, category, component_id)
          VALUES (${preset.id}, ${cat}, ${id})
        `;
      }
    });

    console.log(`  [SUCCESS] Seeded ${config.name} with ${Object.keys(componentIds).length} components.`);
  }

  console.log('--- SEEDING COMPLETE ---');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
