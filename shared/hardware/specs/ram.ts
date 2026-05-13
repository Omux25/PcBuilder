export const extractRamSpecs = (n: string) => {
  const typeMatch = n.match(/\b(DDR[45])\b/i);
  const freqMatch = n.match(/\b(\d{4})\s*MHz\b/i);
  // Kit notation: "2x8GB", "2x16GB", "2 x 16GB", "2\u00d716GB", "2x8Go" (French), "2 x 8 Go"
  const kitMatch = n.match(/(\d+)\s*[xX\u00d7]\s*\d+\s*[Gg][BbOo]/);
  const kit_count = kitMatch ? Math.min(8, Math.max(1, parseInt(kitMatch[1]))) : 1;
  // CAS latency: "CL16", "CL36", "CL40"
  const clMatch = n.match(/[Cc][Ll](\d+)/);
  const cas_latency = clMatch ? parseInt(clMatch[1]) : undefined;
  return {
    ram_type: typeMatch ? typeMatch[1].toUpperCase() : (n.toLowerCase().includes('ddr5') ? 'DDR5' : 'DDR4'),
    frequency_mhz: freqMatch ? parseInt(freqMatch[1]) : (n.toLowerCase().includes('ddr5') ? 5200 : 3200),
    kit_count,
    cas_latency,
  };
};
