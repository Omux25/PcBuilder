export const extractStorageSpecs = (n: string) => {
  const capMatch = n.match(/\b(\d+)\s*(?:gb|go|tb|to)\b/i);
  let capacity_gb: number | null = null;
  if (capMatch) {
    const val = parseInt(capMatch[1]);
    capacity_gb = capMatch[0].toLowerCase().includes('t') ? val * 1000 : val;
  }
  return {
    capacity_gb,
    interface_type: n.toLowerCase().includes('nvme') ? 'NVMe' : 'SATA'
  };
};
