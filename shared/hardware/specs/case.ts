export const extractCaseSpecs = (n: string) => {
  const lengthMatch = n.match(/\b(\d{3})\s*mm\b/i);
  return { max_gpu_length_mm: lengthMatch ? parseInt(lengthMatch[1]) : 350 };
};
