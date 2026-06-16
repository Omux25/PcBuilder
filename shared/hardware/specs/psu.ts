export const extractPsuSpecs = (n: string) => {
  const wMatch = n.match(/\b(\d{2,4})\s*W\b/i);
  let wattage = wMatch ? parseInt(wMatch[1]) : null;

  if (!wattage) {
    // Catch wattage embedded in model names (e.g., RM850x, UD750GM, CV550)
    // We use a broader set of common PSU series prefixes
    const modelWattMatch = n.match(/\b(?:cv|rm|tx|cx|hx|sf|ax|vs|cp|lp|gx|gm|gd|ud|a|p|g|v|mwe|strix|tuf|rog|mag|mpg|lite|pk|dq|da|dp|dq)(\d{3,4})[a-z0-9]{0,3}\b/i);
    if (modelWattMatch) {
      const w = parseInt(modelWattMatch[1]);
      if (w >= 100 && w <= 2000) wattage = w;
    }
  }

  if (!wattage) {
    // Fallback: check for any 3-4 digit number between 200 and 2000 that is a multiple of 50
    const numbers = [...n.matchAll(/(?<!\d)(\d{3,4})(?!\d)/g)].map(m => parseInt(m[1]));
    for (const num of numbers) {
      if (num >= 200 && num <= 2000 && num % 50 === 0) {
        wattage = num;
        break;
      }
    }
  }

  let efficiency = null;
  const efficiencyMatch = n.match(/\b80(?:\s*Plus|\+)?\s*(Titanium|Platinum|Gold|Silver|Bronze|White|Standard)?\b/i);
  if (efficiencyMatch) {
    const rating = efficiencyMatch[1] ? efficiencyMatch[1].charAt(0).toUpperCase() + efficiencyMatch[1].slice(1).toLowerCase() : '';
    efficiency = `80Plus ${rating}`.trim();
  } else {
    // Standalone efficiency ratings match
    const standaloneMatch = n.match(/\b(Titanium|Platinum|Gold|Silver|Bronze|White)\b/i);
    if (standaloneMatch) {
      const rating = standaloneMatch[1].charAt(0).toUpperCase() + standaloneMatch[1].slice(1).toLowerCase();
      efficiency = `80Plus ${rating}`;
    } else if (/\b80\s*(Plus|\+)?\b/i.test(n)) {
      efficiency = '80Plus';
    }
  }

  // Model-based series fallbacks for efficiency if still null
  if (!efficiency) {
    const lowerN = n.toLowerCase();
    if (/\b(thor|loki|meg\s*ai\d+|ai\d+p|ai\d+t|px\d{3,4}p|sx\s*\d{3,4}[a-z]*|sx\d{3,4}[a-z]*)\b/.test(lowerN)) {
      efficiency = '80Plus Platinum';
    } else if (/\b(rm\d{3,4}[a-z]*|hx\d{3,4}[a-z]*|focus|prime|vertex|mpg|mag\s*a?\d{3,4}gl\w*|mag\s*a?\d{3,4}gs\w*|mag\s*a?\d{3,4}gn\w*|toughpower\s*gf|toughpower|ud\d{3,4}gm|tuf\s*gaming\s*a?\d{3,4}g\w*|edge|c\d{3,4}\s*gold|kcas\s*\d+g|ne\d{3,4}g\w*|pn\d{3,4}[a-z]*|pm\d{3,4}[a-z]*|hummer\s*gd|hummer\s*x|gp\s*ap\d*)\b/.test(lowerN)) {
      efficiency = '80Plus Gold';
    } else if (/\b(cv\d{3,4}[a-z]*|cx\d{3,4}[a-z]*|mag\s*a?\d{3,4}bn\w*|csk\d{3,4}[a-z]*|b12|g12|tuf\s*gaming\s*a?\d{3,4}b\w*|mwe\s*bronze|lux|vx\s*plus|mpiii|pl\d{3,4}-d|pk\d{3,4}[a-z]*|c\d{3,4}\s*bronze|ll-ps|urano\s*vx|rb\s*series|kratos\s*[e|p]\d*|mpb\d{3,4}[a-z]*)\b/.test(lowerN)) {
      efficiency = '80Plus Bronze';
    }
  }

  let modularity = null;
  const modularityMatch = n.match(/\b(Full|Fully|Semi|Non)[-\s]*(Modulaire|Modular)?\b/i);
  if (modularityMatch) {
    const prefix = modularityMatch[1].toLowerCase();
    if (prefix === 'full' || prefix === 'fully') modularity = 'Full';
    else if (prefix === 'semi') modularity = 'Semi';
    else if (prefix === 'non') modularity = 'None';
  } else if (/\bModulaire\b/i.test(n)) {
    modularity = 'Full';
  } else {
    // Brand & model modularity heuristics
    const lowerN = n.toLowerCase();
    if (
      /\b(rm\d{3,4}[a-z]*|hx\d{3,4}[a-z]*|ax\d{3,4}[a-z]*|px\d{3,4}[a-z]*|sp\d{3,4}[a-z]*|sx\d{3,4}[a-z]*|pn\d{3,4}[a-z]*|focus\s*plus|prime\s*gold|prime\s*platinum|vertex\s*gx|toughpower\s*gf\w*|straight\s*power|dark\s*power|mwe\s*gold|v\d{3,4}[a-z]*|xg\d{3,4}|atom\s*g\d{3,4}|c\d{3,4}\s*(gold|bronze|platinum)|ud\d{3,4}gm|p\d{3,4}gm|ne\d{3,4}g\w*|a\d{3,4}gls|a850gls|hx\d{3,4}i|loki|thor|rog\s*strix\s*\d{3,4}[a-z]*|rog\s*strix|strix|tuf\s*gaming\s*\d{3,4}g\w*|rog\s*strix\s*\d{3,4}g|prime\s*ap|edge\s*(gold|platinum)|edge|mwe\s*gold\s*v[23]|mwe\s*gold\s*\d{3,4}|g12\s*gm|ud\d{3,4}[a-z]*|p\d{3,4}ss|p\d{3,4}gm|gaming\s*usa\s*e2|mpg\s*a?\d{3,4}g\w*|meg\s*a?\d{3,4}\w*|mag\s*a?\d{3,4}gl\w*|mag\s*a?\d{3,4}gs\w*|mag\s*a?\d{3,4}gn\w*|tuf\s*gaming\s*a?\d{3,4}g\w*|focus|prime|vertex|px\d{3,4}|pq\d{3,4}|hummer\s*x)\b/.test(lowerN) &&
      !/\b(non|semi)\b/.test(lowerN)
    ) {
      modularity = 'Full';
    } else if (/\b(cx\d{3,4}m|tx\d{3,4}m|mwe\s*bronze|system\s*power|pure\s*power\s*\d+\s*m|g12\s*gm|ea\d{3,4}g\s*pro|c\d{3,4}\s*bronze|g750|g850|g1000|mpb\d{3,4}m|kratos\s*p\d*)\b/.test(lowerN) && !/\b(non|semi)\b/.test(lowerN)) {
      modularity = 'Semi';
    } else if (/\b(cv\d{3,4}[a-z]*|cx\d{3,4}[^m]|elite|smart|litepower|b12|mwe\s*bronze\s*v[23]|mag\s*a\d{3,4}b|a\d{3,4}dn|a\d{3,4}n|anima|apb\d{3}|apiii|atom\s*b\d{3}|c\d{3,4}\s*bronze|connect\s*\d{3,4}w|550w\s*80plus\s*bronze|650w\s*80plus\s*bronze|connect\s*(psu|pc)|hybrok\s*psu|csk\d{3,4}[a-z]*|mag\s*a?\d{3,4}bn\w*|mag\s*a?\d{3,4}dn\w*|tuf\s*gaming\s*a?\d{3,4}b\w*|lux|vx\s*plus|kcas|pf\d{3,4}|pk\d{3,4}|pl\d{3,4}-d|mpiii|ll-ps|urano\s*vx|rb\s*series|mpb\d{3,4}[^m]|hummer\s*gd)\b/.test(lowerN)) {
      modularity = 'None';
    }
  }
  
  const formFactorMatch = n.match(/\b(SFX-L|SFX|TFX)\b/i);
  let form_factor = formFactorMatch ? formFactorMatch[1].toUpperCase() : undefined;
  
  if (!form_factor) {
    const lowerN = n.toLowerCase();
    if (/\b(loki|sx\d{3,4}[a-z]*|sf\d{3,4}[a-z]*|dagger\s*pro|sp\d{3,4}[a-z]*|v\d{3,4}\s*sfx)\b/.test(lowerN)) {
      if (lowerN.includes('loki')) form_factor = 'SFX-L';
      else form_factor = 'SFX';
    } else {
      form_factor = 'ATX'; // Default
    }
  }

  return { 
    wattage,
    efficiency,
    modularity,
    form_factor
  };
};

export function normalizeEfficiencyRating(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.toLowerCase().trim();
  if (n.includes('titanium') || n.includes('titane')) return '80+ Titanium';
  if (n.includes('platinum') || n.includes('platine')) return '80+ Platinum';
  if (n.includes('gold') || n.includes('or')) return '80+ Gold';
  if (n.includes('silver') || n.includes('argent')) return '80+ Silver';
  if (n.includes('bronze')) return '80+ Bronze';
  if (n.includes('white')) return '80+ White';
  if (n.includes('80+') || n.includes('80 plus') || n.includes('80plus')) return '80+';
  return null;
}

export function normalizeModularity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.toLowerCase().trim();
  if (n.includes('full') || n === 'fully' || n === 'true') return 'Full';
  if (n.includes('semi') || n === 'partiellement') return 'Semi';
  if (n.includes('non') || n.includes('none') || n === 'false') return 'Non';
  return null;
}

export function normalizePsuFormFactor(raw: string | null | undefined): string | null {
  if (!raw) return 'ATX';
  const n = raw.toUpperCase().trim();
  if (n.includes('SFX-L')) return 'SFX-L';
  if (n.includes('SFX')) return 'SFX';
  if (n.includes('TFX')) return 'TFX';
  if (n.includes('FLEX')) return 'Flex-ATX';
  if (n.includes('ATX')) return 'ATX';
  return 'ATX';
}

