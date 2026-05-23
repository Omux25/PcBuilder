export const extractRamSpecs = (n: string) => {
  const typeMatch = n.match(/\b(DDR[345])\b/i);
  const freqMatch = n.match(/\b(\d{4})\s*(MHz|MT\/s)\b/i);

  // 1. Detect Kit Notation: "2x8GB", "2 x 16GB", "32Gx2", "16Go*2", etc.
  const kitMatch = n.match(/(\d+)\s*[xX\u00d7*]\s*(\d+)\s*[Gg][BbOoGg]|(\d+)\s*[Gg][BbOoGg]\s*[xX\u00d7*]\s*(\d+)/);
  let kit_count = 1;
  let stick_capacity: number | undefined;

  if (kitMatch) {
    if (kitMatch[1] && kitMatch[2]) {
      // "2x8GB"
      kit_count = Math.min(8, Math.max(1, parseInt(kitMatch[1])));
      stick_capacity = parseInt(kitMatch[2]);
    } else if (kitMatch[3] && kitMatch[4]) {
      // "32Gx2"
      stick_capacity = parseInt(kitMatch[3]);
      kit_count = Math.min(8, Math.max(1, parseInt(kitMatch[4])));
    }
  }

  // 2. Detect Standalone Capacity: "16GB", "32Go", "64G", etc.
  const standaloneMatches = [...n.matchAll(/\b(\d+)\s*[Gg][BbOoGg]?\b/g)];
  const capacities = standaloneMatches.map(m => parseInt(m[1]));
  
  let total_capacity = capacities.length > 0 ? Math.max(...capacities) : undefined;

  // If we have notation (2x8GB) but total is same as stick (8GB), fix it to 16GB
  if (stick_capacity && kit_count > 1) {
    if (!total_capacity || total_capacity === stick_capacity) {
      total_capacity = stick_capacity * kit_count;
    }
  } else if (stick_capacity && !total_capacity) {
    total_capacity = stick_capacity * kit_count;
  }

  // Fallback: If frequency is missing, look for standard RAM frequency values in the string
  let frequency_mhz = freqMatch ? parseInt(freqMatch[1]) : undefined;
  if (!frequency_mhz) {
    const stdFreqMatch = n.match(/\b(800|1066|1333|1600|1866|2133|2400|2666|2933|3000|3200|3600|4000|4400|4800|5200|5600|6000|6200|6400|6600|6800|7200|7600|8000)\b/);
    if (stdFreqMatch) {
      frequency_mhz = parseInt(stdFreqMatch[1]);
    }
  }

  // Fallback: If ram_type is missing, infer it from frequency
  let ram_type = typeMatch ? typeMatch[1].toUpperCase() : undefined;
  if (!ram_type && frequency_mhz) {
    if (frequency_mhz >= 4800) {
      ram_type = 'DDR5';
    } else if (frequency_mhz >= 2133 && frequency_mhz <= 4600) {
      ram_type = 'DDR4';
    } else if (frequency_mhz >= 800 && frequency_mhz <= 1866) {
      ram_type = 'DDR3';
    }
  }

  // Default capacity if completely missing in name string
  if (!total_capacity) {
    if (ram_type === 'DDR5') total_capacity = 16;
    else total_capacity = 8;
  }

  // Sanity Bounds: Forcefully reject capacities > 128GB (likely storage miscategorized as RAM)
  if (total_capacity > 128) {
    total_capacity = undefined;
  }

  // 3. Manufacturer Part Number (MPN) Extraction — The "No Guessing" Token
  // Patterns for major brands: Kingston (KF/HX), Corsair (CM), G.Skill (F4/F5), Crucial (CT), Lexar (LD)
  const mpnMatch = n.match(/\b(KF\d[A-Z0-9-]+|HX\d[A-Z0-9-]+|CM[A-Z0-9-]+|F[45]-[A-Z0-9-]+|CT\d+[A-Z0-9-]+|LD[A-Z0-9-]+)\b/i);
  const mpn = mpnMatch ? mpnMatch[1].toUpperCase() : undefined;

  // CAS latency: "CL16", "CL36", "C40", "C18", etc.
  const clMatch = n.match(/\b[Cc][Ll]?(\d{2})\b/);
  const cas_latency = clMatch ? parseInt(clMatch[1]) : undefined;

  // Aesthetic Guardrails (Prevent variant fusion)
  let color: string | undefined = undefined;
  if (/\b(white|blanc)\b/i.test(n)) color = 'White';
  else if (/\b(black|noir)\b/i.test(n)) color = 'Black';
  
  const is_rgb = /\bRGB\b/i.test(n);

  return {
    ram_type,
    frequency_mhz,
    capacity_gb: total_capacity,
    kit_count,
    cas_latency,
    mpn,
    color,
    is_rgb
  };
};

