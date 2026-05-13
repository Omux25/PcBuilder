export const extractPsuSpecs = (n: string) => {
  const wMatch = n.match(/\b(\d{3,4})\s*W\b/i);
  return { wattage: wMatch ? parseInt(wMatch[1]) : 750 };
};
