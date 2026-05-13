export const extractRamSpecs = (n: string) => {
  const typeMatch = n.match(/\b(DDR[45])\b/i);
  const freqMatch = n.match(/\b(\d{4})\s*MHz\b/i);

  // 1. Detect Kit Notation: "2x8GB", "2 x 16GB", "2\u00d78Go", etc.
  // Extract BOTH stick count and stick capacity
  const kitMatch = n.match(/(\d+)\s*[xX\u00d7*]\s*(\d+)\s*[Gg][BbOo]/);
  const kit_count_from_notation = kitMatch ? Math.min(8, Math.max(1, parseInt(kitMatch[1]))) : 1;
  const stick_capacity = kitMatch ? parseInt(kitMatch[2]) : undefined;

  // 2. Detect Standalone Capacity: "16GB", "32Go", etc.
  // Often retailers put the total capacity first: "16GB (2x8GB)"
  const standaloneMatches = [...n.matchAll(/\b(\d+)\s*[Gg][BbOo]\b/g)];
  const capacities = standaloneMatches.map(m => parseInt(m[1]));
  
  let total_capacity = capacities.length > 0 ? Math.max(...capacities) : undefined;
  let kit_count = kit_count_from_notation;

  // If we have a kit notation (e.g. 2x8GB) but total_capacity is same as stick_capacity (8GB),
  // then total_capacity should be stick_capacity * kit_count.
  if (stick_capacity && kit_count > 1) {
    if (!total_capacity || total_capacity === stick_capacity) {
      total_capacity = stick_capacity * kit_count;
    }
  }

  // If "Kit" or "Pack" is mentioned and we have no kit_count > 1, assume 2 sticks
  // unless it's a very large capacity that might be a single stick.
  if (kit_count === 1 && /\b(kit|pack|bundle)\b/i.test(n) && total_capacity) {
    if (total_capacity >= 16 && total_capacity % 2 === 0) {
      kit_count = 2;
    }
  }

  // CAS latency: "CL16", "CL36", "CL40"
  const clMatch = n.match(/\b[Cc][Ll](\d+)\b/);
  const cas_latency = clMatch ? parseInt(clMatch[1]) : undefined;

  return {
    ram_type: typeMatch ? typeMatch[1].toUpperCase() : (n.toLowerCase().includes('ddr5') ? 'DDR5' : 'DDR4'),
    frequency_mhz: freqMatch ? parseInt(freqMatch[1]) : (n.toLowerCase().includes('ddr5') ? 5200 : 3200),
    capacity_gb: total_capacity,
    kit_count,
    cas_latency,
  };
};

