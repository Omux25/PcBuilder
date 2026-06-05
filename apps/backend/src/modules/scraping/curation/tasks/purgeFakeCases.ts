import type { SqlFn } from '../../../../core/db/index.js';
import type { TaskResult } from '../curationEngine.js';

const COOLING_ROUTING_RULES: Array<{
  keywords: string[];
  targetCategory: string;
  label: string;
}> = [
  {
    keywords: ['aio', 'watercooling', 'watercooler', 'water cooler', 'liquid freezer', 'liquid cooling', 'refroidissement liquide'],
    targetCategory: 'cooling',
    label: 'AIO / Liquid Cooler',
  },
  {
    keywords: ['cooler', 'refroidisseur', 'ventirad', 'cpu cooler', 'air cooler'],
    targetCategory: 'cooling',
    label: 'CPU Cooler',
  },
  {
    keywords: ['pate thermique', 'pâte thermique', 'thermal paste', 'thermal compound', 'thermal grease', 'glacier'],
    targetCategory: 'thermal_paste',
    label: 'Thermal Paste',
  },
  {
    keywords: ['hub', 'fan hub', 'rgb hub', 'argb hub'],
    targetCategory: 'fan',
    label: 'Fan Hub',
  },
  {
    keywords: ['fan', 'ventilateur', 'argb', 'pwm'],
    targetCategory: 'fan',
    label: 'Case Fan / ARGB Fan',
  },
];

function resolveTargetCategory(name: string): string | null {
  const lower = name.toLowerCase();
  for (const rule of COOLING_ROUTING_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.targetCategory;
    }
  }
  return null;
}

export async function purgeFakeCases(sql: SqlFn): Promise<TaskResult> {
  const polluted = (await sql`
    SELECT id, name, brand, category, max_gpu_length_mm, max_cooler_height_mm, supported_motherboards, specs
    FROM components
    WHERE category = 'case'
      AND is_active = true
      AND name ~* '(\\mfan\\M|ventilateur|\\mcooler\\M|refroidisseur|\\baio\\b|watercooling|watercooler|\\bhub\\b|argb|\\bpwm\\b|pate thermique|pâte thermique|thermal paste|glacier)'
  `) as {
    id: number;
    name: string;
    brand: string | null;
    category: string;
    max_gpu_length_mm: number | null;
    max_cooler_height_mm: number | null;
    supported_motherboards: string[] | null;
    specs: Record<string, unknown> | null;
  }[];

  if (polluted.length === 0) {
    return {
      success: true,
      mutatedCount: 0,
      message: 'Case catalog is clean — no cooling pollutants found.'
    };
  }

  let rerouted = 0;

  for (const item of polluted) {
    const targetCategory = resolveTargetCategory(item.name) ?? 'fan';

    let cleanedSpecs: Record<string, unknown> = {};
    if (item.specs && typeof item.specs === 'object') {
      cleanedSpecs = { ...item.specs as Record<string, unknown> };
      delete cleanedSpecs['max_gpu_length_mm'];
      delete cleanedSpecs['max_cpu_cooler_height_mm'];
      delete cleanedSpecs['form_factors'];
    }

    await sql`
      UPDATE components
      SET
        category              = ${targetCategory},
        max_gpu_length_mm     = NULL,
        max_cooler_height_mm  = NULL,
        supported_motherboards = NULL,
        specs                 = ${Object.keys(cleanedSpecs).length > 0 ? JSON.stringify(cleanedSpecs) : null},
        updated_at            = NOW()
      WHERE id = ${item.id}
    `;

    rerouted++;
  }

  return {
    success: true,
    mutatedCount: rerouted,
    message: `Purged ${rerouted} cooling accessories from case catalog.`
  };
}
