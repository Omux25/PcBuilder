export const extractStorageSpecs = (n: string) => {
  const capMatch = n.match(/\b(\d+)\s*(?:gb|go|tb|to|g|t)\b/i);
  let capacity_gb: number | null = null;
  if (capMatch) {
    const val = parseInt(capMatch[1]);
    const unit = capMatch[0].toLowerCase();
    capacity_gb = (unit.includes('t')) ? val * 1000 : val;
  }
  
  let interface_type = n.toLowerCase().includes('nvme') ? 'NVMe' : 'SATA';
  
  // Extract Form Factor (M.2 vs 2.5")
  let form_factor: string | undefined = undefined;
  if (n.toLowerCase().includes('m.2') || n.toLowerCase().includes('nvme')) {
    form_factor = 'M.2';
  } else if (n.includes('2.5') || n.includes('2,5')) {
    form_factor = '2.5"';
  }
  
  // Extract PCIe Generation
  let pcie_gen: string | undefined = undefined;
  if (n.toLowerCase().includes('gen5') || n.toLowerCase().includes('gen 5') || n.toLowerCase().includes('pcie 5')) {
    pcie_gen = 'Gen5';
  } else if (n.toLowerCase().includes('gen4') || n.toLowerCase().includes('gen 4') || n.toLowerCase().includes('pcie 4')) {
    pcie_gen = 'Gen4';
  } else if (n.toLowerCase().includes('gen3') || n.toLowerCase().includes('gen 3') || n.toLowerCase().includes('pcie 3')) {
    pcie_gen = 'Gen3';
  }

  return {
    capacity_gb,
    interface_type,
    form_factor,
    pcie_gen
  };
};
