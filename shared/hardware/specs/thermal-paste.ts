export const extractThermalPasteSpecs = (n: string) => {
  const weightMatch = n.match(/\b(\d+(?:\.\d+)?)\s*(?:grammes?|g)\b/i);
  const isLiquidMetal = /\b(conductonaut|liquid metal)\b/i.test(n);
  const isPad = /\b(carbonaut|kryosheet|pad)\b/i.test(n);
  return {
    weight_grams: weightMatch ? parseFloat(weightMatch[1]) : 4,
    paste_type: isLiquidMetal ? 'liquid_metal' : isPad ? 'pad' : 'paste'
  };
};
