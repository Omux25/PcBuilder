/**
 * Shared specifications payload builder.
 * Constructs a clean specs object for the JSONB field based on category-specific fields.
 */
export function buildSpecsPayload(category: string, s: Record<string, any>): Record<string, any> {
  const payload: Record<string, any> = {};

  if (category === 'cpu') {
    if (s.socket !== undefined) payload.socket = s.socket;
    if (s.tdp !== undefined) payload.tdp = s.tdp;
    if (s.core_count !== undefined) payload.core_count = s.core_count;
    if (s.thread_count !== undefined) payload.thread_count = s.thread_count;
    if (s.base_clock_ghz !== undefined) payload.base_clock_ghz = s.base_clock_ghz;
    if (s.boost_clock_ghz !== undefined) payload.boost_clock_ghz = s.boost_clock_ghz;
  } else if (category === 'motherboard') {
    if (s.socket !== undefined) payload.socket = s.socket;
    if (s.form_factor !== undefined) payload.form_factor = s.form_factor;
    if (s.supported_ram_types !== undefined) payload.supported_ram_types = s.supported_ram_types;
    if (s.max_ram_frequency !== undefined) payload.max_ram_frequency = s.max_ram_frequency;
    if (s.ram_slots !== undefined) payload.ram_slots = s.ram_slots;
    if (s.m2_slots !== undefined) payload.m2_slots = s.m2_slots;
    if (s.sata_ports !== undefined) payload.sata_ports = s.sata_ports;
    if (s.chipset !== undefined) payload.chipset = s.chipset;
  } else if (category === 'gpu') {
    if (s.length_mm !== undefined) payload.length_mm = s.length_mm;
    if (s.tdp !== undefined) payload.tdp = s.tdp;
    if (s.vram_gb !== undefined) payload.vram_gb = s.vram_gb;
    if (s.chipset !== undefined) payload.chipset = s.chipset;
  } else if (category === 'ram') {
    if (s.ram_type !== undefined) payload.ram_type = s.ram_type;
    if (s.capacity_gb !== undefined) payload.capacity_gb = s.capacity_gb;
    if (s.frequency_mhz !== undefined) payload.frequency_mhz = s.frequency_mhz;
    if (s.kit_count !== undefined) payload.kit_count = s.kit_count;
    if (s.cas_latency !== undefined) payload.cas_latency = s.cas_latency;
  } else if (category === 'storage') {
    if (s.interface_type !== undefined) payload.interface_type = s.interface_type;
    if (s.capacity_gb !== undefined) payload.capacity_gb = s.capacity_gb;
    if (s.read_speed_mbps !== undefined) payload.read_speed_mbps = s.read_speed_mbps;
    if (s.write_speed_mbps !== undefined) payload.write_speed_mbps = s.write_speed_mbps;
  } else if (category === 'psu') {
    if (s.wattage !== undefined) payload.wattage = s.wattage;
    if (s.psu_form_factor !== undefined) payload.psu_form_factor = s.psu_form_factor;
    if (s.efficiency_rating !== undefined) payload.efficiency_rating = s.efficiency_rating;
    if (s.modular !== undefined) payload.modular = s.modular;
  } else if (category === 'case') {
    if (s.max_gpu_length_mm !== undefined) payload.max_gpu_length_mm = s.max_gpu_length_mm;
    if (s.form_factor !== undefined) payload.form_factor = s.form_factor;
    if (s.supported_motherboards !== undefined) payload.supported_motherboards = s.supported_motherboards;
    if (s.max_cooler_height_mm !== undefined) payload.max_cooler_height_mm = s.max_cooler_height_mm;
    if (s.supported_psu_form_factors !== undefined) payload.supported_psu_form_factors = s.supported_psu_form_factors;
  } else if (category === 'cooling') {
    if (s.height_mm !== undefined) payload.height_mm = s.height_mm;
    if (s.supported_sockets !== undefined) payload.supported_sockets = s.supported_sockets;
    if (s.max_tdp !== undefined) payload.max_tdp = s.max_tdp;
  } else if (category === 'fan') {
    if (s.size_mm !== undefined) payload.size_mm = s.size_mm;
    if (s.airflow_cfm !== undefined) payload.airflow_cfm = s.airflow_cfm;
    if (s.noise_db !== undefined) payload.noise_db = s.noise_db;
    if (s.rgb !== undefined) payload.rgb = s.rgb;
    if (s.pack_size !== undefined) payload.pack_size = s.pack_size;
  } else if (category === 'thermal_paste') {
    if (s.weight_grams !== undefined) payload.weight_grams = s.weight_grams;
    if (s.thermal_conductivity !== undefined) payload.thermal_conductivity = s.thermal_conductivity;
    if (s.paste_type !== undefined) payload.paste_type = s.paste_type;
  }

  return Object.fromEntries(Object.entries(payload).filter(([_, v]) => v !== undefined && v !== null));
}
