import type { ComponentCategory } from '../types.js';

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  cpu: 'Processeur (CPU)',
  motherboard: 'Carte mère',
  gpu: 'Carte graphique (GPU)',
  ram: 'Mémoire RAM',
  storage: 'Stockage',
  psu: 'Alimentation (PSU)',
  case: 'Boîtier',
  cooling: 'Refroidissement',
  fan: 'Ventilateur',
  thermal_paste: 'Pâte thermique',
  monitor: 'Écran',
  keyboard: 'Clavier',
  mouse: 'Souris',
  headphones: 'Casque / Audio',
  speakers: 'Enceintes',
  webcam: 'Webcam',
  os: 'Système d\'exploitation',
  wired_network_adapter: 'Réseau (Filaire)',
  wireless_network_adapter: 'Réseau (WiFi)',
  sound_card: 'Carte son',
  case_accessory: 'Accessoire boîtier',
  fan_controller: 'Contrôleur ventilateur',
  external_storage: 'Stockage externe',
  optical_drive: 'Lecteur optique',
  ups: 'Onduleur (UPS)',
  accessory: 'Autre accessoire',
};

export const CATEGORY_SLUGS: Record<ComponentCategory, string> = {
  cpu: 'processeur',
  motherboard: 'carte-mere',
  gpu: 'carte-graphique',
  ram: 'memoire-ram',
  storage: 'stockage',
  psu: 'alimentation',
  case: 'boitier',
  cooling: 'refroidissement',
  fan: 'ventilateur',
  thermal_paste: 'pate-thermique',
  monitor: 'ecran',
  keyboard: 'clavier',
  mouse: 'souris',
  headphones: 'casque-audio',
  speakers: 'enceintes',
  webcam: 'webcam',
  os: 'systeme-exploitation',
  wired_network_adapter: 'reseau-filaire',
  wireless_network_adapter: 'reseau-wifi',
  sound_card: 'carte-son',
  case_accessory: 'accessoire-boitier',
  fan_controller: 'controleur-ventilateur',
  external_storage: 'stockage-externe',
  optical_drive: 'lecteur-optique',
  ups: 'onduleur',
  accessory: 'accessoire',
};

export const SLUG_TO_CATEGORY = Object.entries(CATEGORY_SLUGS).reduce((acc, [cat, slug]) => {
  acc[slug] = cat as ComponentCategory;
  return acc;
}, {} as Record<string, ComponentCategory>);

export const RULE_LABELS: Record<string, string> = {
  socket_mismatch: 'Incompatibilité de socket',
  ram_type_mismatch: 'Type de RAM incompatible',
  ram_frequency_exceeded: 'Fréquence RAM dépassée',
  gpu_too_long: 'GPU trop long pour le boîtier',
  psu_underpowered: 'Alimentation insuffisante',
  form_factor_mismatch: 'Format de carte mère incompatible',
  cooler_too_tall: 'Refroidissement trop haut pour le boîtier',
  ram_slots_exceeded: 'Trop de barrettes RAM',
  storage_slots_exceeded: 'Trop de disques de stockage',
  cooler_socket_mismatch: 'Socket CPU non supporté par le ventirad',
  mixed_ram_types: 'Types de RAM mixtes',
  mixed_ram_frequencies: 'Fréquences RAM différentes',
  cpu_cooler_tdp_insufficient: 'Ventirad insuffisant pour le CPU',
  dual_channel_warning: 'Dual-channel non optimal',
  psu_form_factor_mismatch: 'Format d\'alimentation incompatible',
};

export const RULE_TOOLTIPS: Record<string, string> = {
  socket_mismatch: 'Le processeur et la carte mère doivent avoir le même socket (ex: AM5) pour fonctionner ensemble.',
  ram_type_mismatch: 'La carte mère ne supporte pas ce type de RAM (DDR4 vs DDR5).',
  ram_frequency_exceeded: 'La RAM fonctionnera à une vitesse inférieure, limitée par la carte mère ou le processeur.',
  gpu_too_long: 'La carte graphique est trop longue et ne rentrera pas physiquement dans ce boîtier.',
  psu_underpowered: 'L\'alimentation choisie n\'offre pas assez de puissance pour faire tourner ces composants de manière stable.',
  form_factor_mismatch: 'La carte mère ne rentre pas dans ce boîtier. Vérifiez les formats supportés (ATX, mATX, ITX).',
  cooler_too_tall: 'Le ventirad CPU est trop haut pour ce boîtier. Vérifiez la hauteur maximale supportée.',
  ram_slots_exceeded: 'La carte mère n\'a pas assez de slots DIMM pour le nombre de barrettes RAM sélectionnées.',
  storage_slots_exceeded: 'La carte mère n\'a pas assez de ports M.2 et SATA pour le nombre de disques sélectionnés.',
  cooler_socket_mismatch: 'Ce ventirad n\'est pas compatible avec le socket de votre processeur. Vérifiez les sockets supportés.',
  mixed_ram_types: 'Vous avez mélangé des barrettes DDR4 et DDR5. Un PC ne peut utiliser qu\'un seul type de RAM.',
  mixed_ram_frequencies: 'Les barrettes RAM ont des fréquences différentes. Le système fonctionnera à la fréquence la plus basse.',
  cpu_cooler_tdp_insufficient: 'Le ventirad n\'est pas conçu pour dissiper autant de chaleur que votre CPU. Risque de throttling thermique.',
  dual_channel_warning: 'Un nombre impair de barrettes RAM désactive le mode dual-channel. Utilisez 2 ou 4 barrettes pour de meilleures performances.',
  psu_form_factor_mismatch: 'L\'alimentation ne rentre pas physiquement dans ce boîtier. Vérifiez le format supporté (ATX, SFX, etc.).',
};

export const CORE_CATEGORIES: ComponentCategory[] = [
  'cpu', 'cooling', 'motherboard', 'ram', 'storage', 'gpu', 'case', 'psu', 'os'
];

export const CATEGORY_GROUPS: { label: string; categories: ComponentCategory[] }[] = [
  {
    label: 'Cartes d\'extension / Réseau',
    categories: ['sound_card', 'wired_network_adapter', 'wireless_network_adapter']
  },
  {
    label: 'Périphériques',
    categories: ['monitor', 'keyboard', 'mouse', 'headphones', 'speakers', 'webcam']
  },
  {
    label: 'Accessoires / Autres',
    categories: [
      'fan', 'case_accessory', 'fan_controller', 'thermal_paste',
      'external_storage', 'optical_drive', 'ups', 'accessory'
    ]
  }
];

export const CATEGORY_ORDER: ComponentCategory[] = [
  ...CORE_CATEGORIES,
  ...CATEGORY_GROUPS.flatMap(g => g.categories)
];

// Compatibility Engine Constants
export const PSU_SAFETY_MULTIPLIER = 1.5;
export const PSU_ROUNDING_STEP = 50;
export const BASE_SYSTEM_LOAD_WATTS = 50;

// Configurator Engine Constants
export const MAX_RAM_SLOTS = 8;
export const MAX_STORAGE_SLOTS = 8;