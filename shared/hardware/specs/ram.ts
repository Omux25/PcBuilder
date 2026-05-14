export const extractRamSpecs = (n: string) => {
  const typeMatch = n.match(/\b(DDR[45])\b/i);
  const freqMatch = n.match(/\b(\d{4})\s*(MHz|MT\/s)\b/i);

  // 1. Detect Kit Notation: "2x8GB", "2 x 16GB", "2\u00d78Go", etc.
  const kitMatch = n.match(/(\d+)\s*[xX\u00d7*]\s*(\d+)\s*[Gg][BbOo]/);
  const kit_count_from_notation = kitMatch ? Math.min(8, Math.max(1, parseInt(kitMatch[1]))) : 1;
  const stick_capacity = kitMatch ? parseInt(kitMatch[2]) : undefined;

  // 2. Detect Standalone Capacity: "16GB", "32Go", etc.
  const standaloneMatches = [...n.matchAll(/\b(\d+)\s*[Gg][BbOo]\b/g)];
  const capacities = standaloneMatches.map(m => parseInt(m[1]));
  
  let total_capacity = capacities.length > 0 ? Math.max(...capacities) : undefined;
  let kit_count = kit_count_from_notation;

  // If we have notation (2x8GB) but total is same as stick (8GB), fix it to 16GB
  if (stick_capacity && kit_count > 1) {
    if (!total_capacity || total_capacity === stick_capacity) {
      total_capacity = stick_capacity * kit_count;
    }
  }

  // 3. Manufacturer Part Number (MPN) Extraction — The "No Guessing" Token
  // Patterns for major brands: Kingston (KF/HX), Corsair (CM), G.Skill (F4/F5), Crucial (CT), Lexar (LD)
  const mpnMatch = n.match(/\b(KF\d[A-Z0-9-]+|HX\d[A-Z0-9-]+|CM[A-Z0-9-]+|F[45]-[A-Z0-9-]+|CT\d+[A-Z0-9-]+|LD[A-Z0-9-]+)\b/i);
  const mpn = mpnMatch ? mpnMatch[1].toUpperCase() : undefined;

  // CAS latency: "CL16", "CL36", "CL40"
  const clMatch = n.match(/\b[Cc][Ll](\d+)\b/);
  const cas_latency = clMatch ? parseInt(clMatch[1]) : undefined;

  // Aesthetic Guardrails (Prevent variant fusion)
  let color: string | undefined = undefined;
  if (/\b(white|blanc)\b/i.test(n)) color = 'White';
  else if (/\b(black|noir)\b/i.test(n)) color = 'Black';
  
  const is_rgb = /\bRGB\b/i.test(n);

  return {
    ram_type: typeMatch ? typeMatch[1].toUpperCase() : undefined,
    frequency_mhz: freqMatch ? parseInt(freqMatch[1]) : undefined,
    capacity_gb: total_capacity,
    kit_count,
    cas_latency,
    mpn,
    color,
    is_rgb
  };
};

