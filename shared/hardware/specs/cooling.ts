export const extractCoolingSpecs = (n: string) => {
  const tdpMatch = n.match(/\b(\d+)\s*W\b/i);
  return { tdp: tdpMatch ? parseInt(tdpMatch[1]) : 200 };
};
