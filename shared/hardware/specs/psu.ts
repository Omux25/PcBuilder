export const extractPsuSpecs = (n: string) => {
  const wMatch = n.match(/\b(\d{2,4})\s*W\b/i);
  let wattage = wMatch ? parseInt(wMatch[1]) : null;

  if (!wattage) {
    // Catch wattage embedded in model names (e.g., RM850x, UD750GM, CV550)
    // We use a broader set of common PSU series prefixes
    const modelWattMatch = n.match(/\b(?:cv|rm|tx|cx|hx|sf|ax|vs|cp|lp|gx|gm|gd|ud|a|p|g|v|mwe|strix|tuf|rog|mag|mpg|mpg|lite|pk|dq|da|dp|dq)(\d{3,4})[a-z0-9]{0,3}\b/i);
    if (modelWattMatch) {
      const w = parseInt(modelWattMatch[1]);
      if (w >= 100 && w <= 2000) wattage = w;
    }
  }

  const efficiencyMatch = n.match(/\b80\s*Plus\s*(Titanium|Platinum|Gold|Silver|Bronze|White|Standard)?\b/i);
  let efficiency = null;
  if (efficiencyMatch) {
    const rating = efficiencyMatch[1] ? efficiencyMatch[1].charAt(0).toUpperCase() + efficiencyMatch[1].slice(1).toLowerCase() : '';
    efficiency = `80Plus ${rating}`.trim();
  } else if (/\b(Bronze|Gold|Platinum|Titanium)\b/i.test(n) && /\b(80\s*Plus|80\+)\b/i.test(n)) {
    // Catch cases where 80 Plus and Gold/Bronze are separated
    const ratingMatch = n.match(/\b(Titanium|Platinum|Gold|Silver|Bronze|White)\b/i);
    efficiency = `80Plus ${ratingMatch ? ratingMatch[1].charAt(0).toUpperCase() + ratingMatch[1].slice(1).toLowerCase() : ''}`.trim();
  }

  const modularityMatch = n.match(/\b(Full|Semi|Non)[-\s]*(Modulaire|Modular)\b/i);
  let modularity = null;
  if (modularityMatch) {
    const prefix = modularityMatch[1].toLowerCase();
    if (prefix === 'full') modularity = 'Full';
    else if (prefix === 'semi') modularity = 'Semi';
    else if (prefix === 'non') modularity = 'None';
  } else if (/\bModulaire\b/i.test(n)) {
    modularity = 'Full'; // Conventionally, "Modulaire" without prefix often implies Full
  }
  
  const formFactorMatch = n.match(/\b(SFX-L|SFX|TFX)\b/i);
  const form_factor = formFactorMatch ? formFactorMatch[1].toUpperCase() : 'ATX';

  return { 
    wattage,
    efficiency,
    modularity,
    form_factor
  };
};
