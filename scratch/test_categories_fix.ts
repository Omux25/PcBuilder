function inferCategoryFixed(name: string): string | null {
  const n = name.toLowerCase();

  // 163 case check with proposed fix
  if (n.match(/^(mars\s*gaming|m\.red|hybrok|sg\b|xtrmlab|azza|nox\b|setup\s*game|raijintek|itek|spirit\s*of\s*gamer|havn|montech|kolink|cougar|aerocool|antec|icelil|apnx)\b/) &&
    !n.match(/\b(fan|ventilateur|80plus|argb\s+fan|rgb\s+fan|\d+\s*x\s*\d+mm|triple\s*pack|dual\s*pack|pack\s*(de\s*\d+|\d+)|fan\s*controller|hub|paste|thermal|psu|alimentation|ram|ssd|gpu|cpu|motherboard|hl\d{2,3}[a-z]?|symphony|core\s*plus|ap1-v|cooler|cooling|refroidissement|ventirad|refroidisseur|lux|kcas|kratos|vx|plus|cylon|kc|mpb|mpiii|gex|vte|xtc|bxm|\d{3,4}\s*w|450|500|550|600|650|700|750|850|1000|1200|1300|1500|h2o|k120|k240|k360|aio|liquid|f902|shadow|frost|spectra|p240|p360|y240|y360|sg\d{2}-\d{3}-lcd|ml-?one\d{3}|universal|screen)\b/i) &&
    !n.match(/\b80\+(?!\w)/i)) {
      return 'case';
  }

  // standard PSU rule check
  if ((n.match(/\b(\d{3,4}\s*(w|watt|v\d+|230v|atx|80\+|gold|bronze|plus|modular|semi.?modular|full.?modular))\b/i) ||
       n.match(/\b(lux|vx\s*plus|kcas|kratos|smart\s*rgb|toughpower|tru2|core\s*reactor|cv\d{3}[a-z]*|cx\d{3,4}[a-z]*|vs\d{3,4}[a-z]*|mag\s*a\d{3,4}[a-z]*|mpg\s*a\d{3,4}[a-z]*|rm\d{3,4}[eix]|tx\d{3,4}[a-z]*|hx\d{3,4}[a-z]*|ax\d{3,4}[a-z]*|sf\d{3,4}[a-z]*|straight\s*power|dark\s*power|system\s*power|pure\s*power|p[567]50ss|pl\d{3}-d|px\d{3,4}-?[pg]|ai\d{4}t|a\d{3,4}gs?|a\d{3,4}gls?|a\d{3,4}g|mwe|smart|anima|ne\d{3,4}[gm]|csk\d{3,4}|vp\d{3,4}|cv\d{3}|cx\d{3}|vs\d{3})\b/i)) &&
      (n.match(/\b(alimentation|psu|power\s*supply|modular|watt|\d{3,4}w|80\s*plus|80plus|230v|atx\d\.\d)\b/i) || n.match(/\b(lux|vx\s*plus|kcas|kratos|rm\d{3,4}[a-z]*|cx\d{3,4}[a-z]*|cv\d{3}[a-z]*|mag\s*a\d{3,4}[a-z]*|mpg\s*a\d{3,4}[a-z]*|ne\d{3,4}[gm]|csk\d{3,4}|vp\d{3,4})\b/i)) &&
      !n.match(/\b(case|boitier|tower|chassis|bo\u00eetier|motherboard|mb|socket|cpu\s*cooler|water\s*cooler|refroidissement|fan|gpu|ram|storage|ssd|hdd|kingston|wd|western\s*digital|crucial|goodram|patriot|adata|lexar|teamgroup|pny|hiksemi|silicon\s*power|sandisk|arctic|nova|aio|liquid|watercooler|watercooling)\b/i)) return 'psu';

  return 'other';
}

const testNames = [
  'Antec B750 Ec 80+ 750W ATX',
  'Antec NE1000G M 80+ Gold 1000W ATX 3.0',
  'Antec AX61 ELITE',
  'Antec C3 ARGB'
];

console.log('--- Testing Fixed Category Inference ---');
for (const name of testNames) {
  console.log(`Name: "${name}" -> Category: "${inferCategoryFixed(name)}"`);
}
