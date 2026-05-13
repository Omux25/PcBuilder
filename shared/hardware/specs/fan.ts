export const extractFanSpecs = (n: string) => {
  const sizeMatch = n.match(/\b(80|92|120|140|200)\s*mm\b/i) || n.match(/\b(80|92|120|140|200)\b/);
  const tripleMatch = /\b(triple|3.?pack|3x)\b/i.test(n);
  const dualMatch = /\b(dual|twin|2.?pack|2x)\b/i.test(n);
  return {
    size_mm: sizeMatch ? parseInt(sizeMatch[1]) : null,
    rgb: /\b(rgb|argb)\b/i.test(n),
    pack_size: tripleMatch ? 3 : dualMatch ? 2 : 1
  };
};
