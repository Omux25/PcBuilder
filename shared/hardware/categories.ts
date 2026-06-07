export type Category =
  | 'cpu'
  | 'gpu'
  | 'motherboard'
  | 'ram'
  | 'storage'
  | 'psu'
  | 'case'
  | 'cooling'
  | 'fan'
  | 'thermal_paste'
  | 'monitor'
  | 'keyboard'
  | 'mouse'
  | 'headphones'
  | 'speakers'
  | 'webcam'
  | 'os'
  | 'wired_network_adapter'
  | 'wireless_network_adapter'
  | 'sound_card'
  | 'case_accessory'
  | 'fan_controller'
  | 'external_storage'
  | 'optical_drive'
  | 'ups'
  | 'accessory'
  | 'build'
  | 'bundle';

export const CATEGORY_PRIORITY: Record<Category, number> = {
  cpu: 3,
  gpu: 3,
  motherboard: 3,
  ram: 3,
  psu: 3,
  fan_controller: 3,
  cooling: 2,
  storage: 2,
  thermal_paste: 2,
  monitor: 2,
  os: 2,
  case: 1,
  fan: 2,
  keyboard: 1,
  mouse: 1,
  headphones: 1,
  speakers: 1,
  webcam: 1,
  wired_network_adapter: 1,
  wireless_network_adapter: 1,
  sound_card: 1,
  case_accessory: 1,
  external_storage: 1,
  optical_drive: 1,
  ups: 1,
  accessory: 1,
  build: 1,
  bundle: 1,
};

export function getCategoryPriority(category: Category | null): number {
  if (!category) return 0;
  return CATEGORY_PRIORITY[category] || 0;
}

/**
 * Heuristic-based category inference from product names.
 */
export function inferCategory(name: string): Category | null {
  const n = name.toLowerCase();

  // 0. Bundles & Builds (Absolute Priority)
  if (n.match(/\b(hydro\s*x|pacific\s*c\d{3}|pacific\s*cl\d{3}|liquid\s*freezer\s*[ivx]+\s*pro)\b/) ||
    (n.match(/\bkit\b/) && n.match(/\b(watercooling|refroidissement\s*liquide|aio)\b/) && n.match(/\b(thermaltake|lian\s*li|corsair|arctic|cooler\s*master|msi|asus|nzxt)\b/))) return 'accessory';

  if (n.match(/\bupgrade\s*kit\b/)) return 'accessory';

  if (n.match(/\b(pack|bundle|kit\s*(pc|gaming)|pc\s*(gamer|gaming|complet|monté))\b/) &&
    !n.match(/\b(case\s*bundle|boitier|boîtier|boitier|bo\u00eetier|boitiers|bo\u00eetiers|hyte|fan|ventilateur|pack|rgb|argb|ram|memory|ddr|ssd|hdd|cpu|gpu|psu|motherboard|carte mère)\b/)) return 'build' as any;

  if (n.match(/\b(boitier|boîtier|tour|case|glass|chassis)\b/) && n.match(/\b(psu|alim|alimentation|watt|wattage)\b/) && n.match(/\+/)) return 'case';

  // 1. Operating Systems
  if (n.match(/\b(windows|microsoft\s*office|win\s*(10|11))\b/)) return 'os';

  // 2. High-Confidence Technical Indicators (CPU & GPU)
  if (n.match(/\b(ryzen|core\s*i[3579]|core\s*ultra|threadripper|xeon|athlon|pentium|celeron|processeur|processor)\b/) &&
    !n.match(/\b(paste|compound|grease|pate|p\u00e2te|cooler|refroidissement|ventirad|fan|ventilateur|case|boitier|tower|frame|bracket|monitor)\b/)) return 'cpu';

  if (n.match(/\b(rtx|gtx|radeon|rx\s*\d{3,4}|arc\s*[ab]\d{3}|geforce|quadro|firepro|gt\s*[2-7]\d{2,3})\b/) &&
    !n.match(/\b(boitier|bo\u00eetier|case|tower|mid.?tower|chassis|riser|mount|holder|kit|monitor|ssd|nvme|m\.2|cooler|cooling|ventirad|helios|strix\s*g[tx]|tuf\s*g|gt301|gt501|gt302|gt502|gr701)\b/)) return 'gpu';
  if (n.match(/\bt\d{3,4}\b/) && n.match(/\bnvidia\b/)) return 'gpu';

  // 2.5. Thermal Paste (High-Confidence Keywords)
  if (n.match(/\b(kryonaut|conductonaut|hydronaut|aeronaut|duronaut|carbonaut|kryosheet|polartherm|tm30|kryofuze|cryofuze|minus\s*pad|wipes|thermal\s*paste|p\u00e2te\s*thermique|pate\s*thermique|thermal\s*compound|thermal\s*grease|mx-[0-9]|mx[0-9]|liquid\s*metal|m\u00e9tal\s*liquide|liquid\s*compound)\b/) &&
    !n.match(/\b(cpu|gpu|ram|ssd|nvme|psu|case|boitier|tower|fan)\b/)) return 'thermal_paste';

  // 3. Known Models / Series overrides
  if (n.match(/\b(prism|spectra|frost|shadow)\b/) &&
      (n.match(/\b(boitier|boîtier|chassis|case|tour|glass)\b/) ||
       (n.match(/\b(xtrmlab|hybrok|setup\s*game|mars\s*gaming|m\.red|kolink|montech|nox|cougar|aerocool|antec|spirit\s*of\s*gamer)\b/) &&
        !n.match(/\b(fan|ventilateur|cooler|cooling|refroidissement|ventirad|watercooling|aio|paste|grease|compound)\b/)))) return 'case';

  if (n.match(/\b(h210i?|h400i?|h440i?|h500i?|h510i?|h590\b|h700i?|h710i?|h5\s*flow|h6\s*flow|h7\s*flow|h9\s*flow|h5\s*elite|h7\s*elite|h9\s*elite|h3\s*flow|h1\s*v2)\b/)) return 'case';
  if (n.match(/be\s*quiet/) && n.match(/\b(pure\s*base|shadow\s*base|silent\s*base|light\s*base|dark\s*base)\b/)) return 'case';
  if (n.match(/\bcx\d{3}\b/) && n.match(/\bantec\b/)) return 'case';
  if (n.match(/\b(gt\d{3})\b/) && n.match(/\b(asus|rog|tuf)\b/) && !n.match(/\b(rtx|gtx|gpu)\b/)) return 'case';
  if (n.match(/\b(h-?112|h-?212|h-?224|hyper\s*212|ak\d{3}|ag\d{3})\b/) || (n.match(/\b(hyper|ak\d{3}|ag\d{3})\b/) && n.match(/\b(cooler|ventirad|cooling)\b/))) return 'cooling';
  if (n.match(/\b(h60|h100|h115|h150|h170)(i|x|v\d)?\b/) && (n.match(/\b(corsair|icue|ventilo|ventirad|cooler|cooling|heat\s*sink)\b/))) return 'cooling';
  if (n.match(/\b(heat\s*sink|ventilo)\b/) && n.match(/\b(intel|amd|lga|socket)\b/)) return 'cooling';
  if (n.match(/\b(a400)\b/) && n.match(/\bantec\b/)) return 'cooling';
  if (n.match(/\b(cx\d{3})\b/) && n.match(/\bgoodram\b/)) return 'storage';

  // 4. Motherboard (Indicators)
  if ((n.match(/\b(carte\s*m[\u00e8e]re|motherboard|mobo|socket|lga\d{4}|am[45]|trx\d{2}|wrx\d{2}|maximus|zenith|crosshair|godlike|dominus|dark\s*hero|hero\b|formula\b|apex\b|extreme\b)\b/) ||
       n.match(/\b([abxhz]\d{3,4}[eimdpqrsv]*|trx\d{2}|wrx\d{2}|lga\d{4})\b/)) &&
      !n.match(/\b(case|boitier|bo\u00eetier|tower|chassis|tg|argb|glass|tempered|gaming\s*chair|souris|mouse|keyboard|headset|monitor|pad|thermal\s*grease|sd|microsd|adapter|card|cooler|cooling|ventirad|refroidissement|aio|watercooler|kit|upgrade|rtx|gtx|rx\s*\d|80plus|gold|watt|\d{3,4}w|cx\d{3,4}|rm\d{3,4}|hx\d{3,4}|tx\d{3,4}|vs\d{3,4}|cv\d{3,4})\b/) &&
      !n.match(/\b(\d+)\s*(gb|go|tb|to|mb\/s)\b/)) return 'motherboard';
  
  if (n.match(/\bmb\b/) && !n.match(/\b(mb\/s|gb|go|to|tb|mo)\b/) && !n.match(/\b(case|boitier|bo\u00eetier|tower|chassis|tg|argb|glass|tempered|ssd|nvme|m\.2)\b/)) return 'motherboard';

  // 5. PSU & Cooling & Storage
  if ((n.match(/\b(v?\d{3,4}[wm]?\s*(w|watt|v\d+|230v|atx|80\+|gold|bronze|plus|modular|modulaire|semi.?modular|full.?modular|sfx))\b/i) ||
       n.match(/\b(lux|vx\s*plus|kcas|kratos|smart\s*rgb|toughpower|tru2|core\s*reactor|cv\d{3}[a-z]*|cx\d{3,4}[a-z]*|vs\d{3,4}[a-z]*|mag\s*a\d{3,4}[a-z]*|mpg\s*a\d{3,4}[a-z]*|rm\d{3,4}[eix]|tx\d{3,4}[a-z]*|hx\d{3,4}[a-z]*|ax\d{3,4}[a-z]*|sf\d{3,4}[a-z]*|straight\s*power|dark\s*power|system\s*power|pure\s*power|p[567]50ss|pl\d{3}-d|px\d{3,4}-?[pg]|ai\d{4}t|a\d{3,4}gs?|a\d{3,4}gls?|a\d{3,4}g|mwe|smart|anima|ne\d{3,4}[gm]|csk\d{3,4}|vp\d{3,4}|cv\d{3}|cx\d{3}|vs\d{3}|aero\s*bronze|sfx)\b/i)) &&
      (n.match(/\b(alimentation|psu|power\s*supply|modular|modulaire|watt|\d{3,4}w|80\s*plus|80plus|230v|atx\d\.\d)\b/i) || n.match(/\b(lux|vx\s*plus|kcas|kratos|rm\d{3,4}[a-z]*|cx\d{3,4}[a-z]*|cv\d{3}[a-z]*|mag\s*a\d{3,4}[a-z]*|mpg\s*a\d{3,4}[a-z]*|ne\d{3,4}[gm]|csk\d{3,4}|vp\d{3,4}|aero\s*bronze)\b/i)) &&
      !n.match(/\b(case|boitier|tower|chassis|bo\u00eetier|motherboard|mb|socket|cpu\s*cooler|water\s*cooler|refroidissement|fan|gpu|ram|storage|ssd|hdd|kingston|wd|western\s*digital|crucial|goodram|patriot|adata|lexar|teamgroup|pny|hiksemi|silicon\s*power|sandisk|arctic|nova|aio|liquid|watercooler|watercooling)\b/i) &&
      !n.match(/\+\s*(psu|alim|alimentation)\b/i) &&
      !n.match(/\b(avec|with)\s+(psu|alim|alimentation)\b/i)) return 'psu';

  if (n.match(/\b(aio|liquid|watercooler|watercooling|refroidissement\s*liquide|liquid\s*freezer|ventirad|refroidissement|aircooler|air\s*cooler|cpu\s*cooler|water\s*cooler|kraken|ryujin|ryuo|strix\s*lc|rog\s*lc|galahad|lq\d{3}|light\s*loop|spartacus|lb\d{3}m*|proart\s*lc|mag\s*coreliquid|mpg\s*coreliquid|meg\s*coreliquid|masterliquid|chione|hydroshift|hydro\s*shift|thicc\s*q\d{2}|ice-?\d{3}|ml-ultra\d{3}|symphony\s*\d{3}|waterforce\s*[x]?\s*\d{3}|\d{3}ml|p240|p360|y240|y360|sg\d{2}-\d{3}-lcd|wraith|prism|t400|t10\b|t20\b|t30\b|glory|f902|shadow|frost|spectra|hl\d{2,3}[a-z]?|ml-?one\d{3}|nova\s*240|nova\s*360|boreas|aura\s*gl\d{3})\b/) &&
      !n.match(/\b(no|sans)\s+watercooling\b/)) return 'cooling';

  if (n.match(/\b(nvme|m\.?2|ssd|hdd|disque\s*(dur|ssd)|hard\s*drive|solid\s*state|firecuda|barracuda|ironwolf|skyhawk|exos|wd\s*(blue|black|red|gold|purple)|sn\d{3,4}|bx\d{3}|mx\d{3}|su\d{3}|p[235]\s*\d{1,3}|legend\s*\d{3}|a400|v-series|sa\d{3}|s270|t70[05]|ns100|cs900|cs1030|cs2130|cs2140|dc\d{3}m?|mp\d{3,4}|intenso|ultrastar|mg08|mg\s*series|wd\d{2}[a-z]{4}|a55|gx2|kc\d{4}|spatium|nq100|hiksemi|fanxiang|s101|s300|s300\s*pro|n300\s*nas|surveillance\s*3\.5|990\s*pro|980\s*pro|970\s*evo|870\s*evo|qvo|cardea|zero\s*z\d{3}|sata\s*iii|2\.5\s*tray|sata\s*2\.5|vi\d{3,4})\b/) &&
    !n.match(/(cpu\s*cooler|ventirad|fan|ventilateur|aeolus|icelil|motherboard|carte\s*m\u00e8re|mb|socket|case|boitier|bo\u00eetier|psu|monitor|ram|ddr[45]|dimm|mhz|aio|liquid|cooler|cooling|msi|asus|gigabyte|asrock|biostar|nzxt|antec)/)) return 'storage';
  if (n.match(/\b(\d+)\s*(gb|go|tb|to)\b/i) && !n.match(/\b(ram|ddr[45]|mhz|cl\d{1,2}|dimm|vram|graphics|video|gpu|rtx|gtx|rx|radeon)\b/i)) return 'storage';

  // 6. RAM
  // GPU Signature Guard: if ANY GPU keyword is present, this is a GPU (VRAM spec in name),
  // NOT system RAM. This prevents "Vga Gt 730 Ddr3 2GB" from bleeding into the RAM category.
  const hasGpuSignature = n.match(/\b(vga|gtx|rtx|rx\s*\d{3,4}|geforce|radeon|arc\s*[ab]\d{3}|carte\s*graphique|gpu)\b/) ||
    n.match(/\bgt\s+\d{3,4}\b/);  // "GT 730", "GT 1030" etc — space-separated to avoid false positives

  if (!hasGpuSignature && n.match(/\b(dimm|ddr[2-5]|sdram|lpx|vengeance|dominator|trident|ripjaws|fury|renegade|vengance|t-force|t-create|delta\s*rgb|vulcan|zeus|expert|flare\s*x|elite\s*plus|elite\s*ii|gaming\s*ram|memory\s*module|m\u00e9moire\s*ram|patriot|viper\s*steel|viper\s*venom|viper\s*rgb|apacer)\b/) &&
    !n.match(/\b(motherboard|psu|case|boitier|tower|cpu|gpu|storage|ssd|nvme|hdd|fan|cooler|souris|mouse|sata|2\.5|tb|to|to\b|[abxhz]\d{3,4}|maximus|zenith|crosshair|godlike|dominus)\b/)) return 'ram';

  // 7. Peripherals & Networking
  if (n.match(/\b(souris|mouse|logitech\s*g|deathadder|basilisk|viper|hero\s*25k)\b/) &&
    !n.match(/\b(ram|ddr[45]|go|gb|mo|mb|cpu|gpu|motherboard|psu|case|boitier|cooler|fan|ssd|hdd|nvme|m\.2|steel|venom|patriot)\b/)) return 'mouse';
  if (n.match(/\b(clavier|keyboard|mechanical\s*keyboard|razer\s*huntsman|logitech\s*g\d{3}|apex\b)\b/) &&
    !n.match(/\b(hyper|ak\d{3}|ag\d{3}|noctua|be\s*quiet|cooler\s*master|deepcool|arctic|thermalright)\b/)) return 'keyboard';
  if (n.match(/\b(casque|headset|headphones|hyperx\s*cloud|blackshark|arctis)\b/)) return 'headphones';
  if (n.match(/\b(webcam|c920|c922|kiyo|streamcam)\b/)) return 'webcam';
  if (n.match(/\b(\u00e9cran|monitor|moniteur|gaming\s*monitor|hz|ms|ips|va|curved)\b/) && !n.match(/\b(gpu|rtx|rx|arc)\b/)) return 'monitor';
  if (n.match(/\b(wifi|wireless|bluetooth|pci-e\s*wifi|usb\s*wifi|antenne|antenna)\b/) &&
    !n.match(/\b([abxhz]\d{3,4}[eimdpqrsv]?|trx\d{2}[a-z]?|wrx\d{2}[a-z]?|souris|mouse|clavier|keyboard|casque|headset|headphones|webcam|monitor|fan|ventilateur|case|boitier)\b/)) return 'wireless_network_adapter';
  if (n.match(/\b(ethernet|rj45|pci-e\s*lan|gigabit\s*lan|network\s*card)\b/)) return 'wired_network_adapter';

  if (n.match(/\b(contr\u00f4leur\s*ventilateur|fan\s*controller|commander\s*pro|lighting\s*node|rgb\s*\&\s*fan\s*controller|fan\s*hub|fh-\d{2}|gh-\d{2}|edge\s*hub|uni\s*fan\s*hub|xh100\s*hub|contr\u00f4leur\s*rgb|rgb\s*hub|fan\s*rgb\s*hub)\b/i)) return 'fan_controller';
  if (n.match(/\b(riser|vertical\s*gpu|holder|bracket|mount|support|riser\s*cable|thermal\s*pad)\b/)) return 'case_accessory';
  if (n.match(/\b(c\u00e2ble|cable|adaptateur|adapter|extension|dock|frame|\u00e9cran|screen)\b/)) return 'accessory';

  // 8. General Fallbacks
  if (n.match(/\b(f120|f140|mf120|mf140|ll\d{3}|ql\d{3}|fd12|fd14|fk120|sickleflow|sicklefan|tl-c12|tl-c14|af\d{3}|sp\d{3}|rs\d{3}|ar\d{3}|ml\d{3}|rs140|rs120|ar120|ar140|f360|f420|fd14|xlf120|xt120|kunai|p12|p14|fl12r|fl12\b|fl14\b|masterfan|halo|light\s*wings|silent\s*wings|pure\s*wings|shadow\s*wings|f\d{3}p|f\d{3}q|f\d{3}rgb|p\d{2}\s*max|rgb\s*core|twin\s*pack|triple\s*pack|dual\s*pack|lx\d{2,3}|eclipse|astro|mirage|glory|glory\s*1|duo\s*12|t10\b|t20\b|t30\b|vortex|ventilateur\s*rgb|ventilateur\s*argb|ventilateur\s*boitier|shark|cyclon|p7-f12|orbit|rev\s*rgb|sg61|sg62)\b/i)) return 'fan';
  if ((n.match(/\b(ventilateur|fan)\b/i) && n.match(/\b(rgb|argb|pwm|120|120mm|140|140mm)\b/i) && !n.match(/\b(case|boitier|bo\u00eetier|cpu\s*cooler|ventirad|watercooler|aio)\b/i))) return 'fan';


  if (n.match(/\b(o11|o11d|vision|vector|lancool|dynamic|pano|forge|gungnir|sekira|mag\s*pano|mpg\s*gungnir|mag\s*forge|mag\s*shield|m100a|120a|ap201|ap202|gt301|gt302|gt501|gt502|gr701|helios|hyperion|proart\s*pa\d*|tuf\s*gaming\s*gt|a21|a31|mc500|mc51|mc61|mca|mcmesh|mcorb|mc\d{2,3}|talos|aura\s*gc|gamdias|c8|c3|c5|c7|df800|ragn\u00e4r|nightcity|biohazard|tooq|y40|y60|y70|y70\s*touch|corsair\s*air|montech\s*air|pop\s*(air|mini|silent)|define\s*(7|c|mini|r\d)|meshify\s*(2|c)|torrent|north|ridge|terra|mood|morpheus|a3\b|cte\b|cmt\d+|fv150|fv235|mc-ultra|mc-custom|mcultra|qube\s*500|qube\s*540|masterframe|tomahawk\s*atx|tomahawk\s*itx|odyssey\s*x|t350m|465x|airface|blader|hadron|k20|z1|velox|panoglass|airboost|stealth|bolt)\b/) &&
    !n.match(/\b(motherboard|mb|cpu\s*cooler|ventirad|water\s*cooler|liquid|monitor|mouse|keyboard|fan|halo|wing|light\s*wings|wraith|amd\s*wraith|masterair|masterliquid|pure\s*loop|shadow\s*loop|silent\s*loop)\b/)) return 'case';

  if (n.match(/\b(masterbox|mastercase|silencio|haf\s*\d+|td\d{3}|cm\s*\d{4}[a-z]*|cmp\d{3}|elite\s*(310|330|340|350|370|430|500))\b/)) return 'case';
  if (n.match(/\b(carbide|crystal\s*\d{3}[a-z]*|obsidian|spec.omega|spec.delta|frame\s*\d{4}|icue\s*\d{4}[a-z]*(?!\s*rx)|icue\s*link\s*\d{4}|2500x|3000d|3500x|6500d|6500x|4000d|5000d|4000x|5000x)\b/)) return 'case';
  if (n.match(/\b(divider\s*\d+|view\s*\d+|level\s*20|core\s*[pvx]\d*)\b/) && n.match(/\b(thermaltake|tt)\b/)) return 'case';
  if (n.match(/^(mars\s*gaming|m\.red|hybrok|sg\b|xtrmlab|azza|nox\b|setup\s*game|raijintek|itek|spirit\s*of\s*gamer|havn|montech|kolink|cougar|aerocool|antec|icelil|apnx)\b/) &&
    !n.match(/\b(fan|ventilateur|80plus|argb\s+fan|rgb\s+fan|\d+\s*x\s*\d+mm|triple\s*pack|dual\s*pack|pack\s*(de\s*\d+|\d+)|fan\s*controller|hub|paste|thermal|psu|alimentation|ram|ssd|gpu|cpu|motherboard|hl\d{2,3}[a-z]?|symphony|core\s*plus|ap1-v|cooler|cooling|refroidissement|ventirad|refroidisseur|lux|kcas|kratos|vx|plus|cylon|kc|mpb|mpiii|gex|vte|xtc|bxm|\d{3,4}\s*w|450|500|550|600|650|700|750|850|1000|1200|1300|1500|h2o|k120|k240|k360|aio|liquid|f902|shadow|frost|spectra|p240|p360|y240|y360|sg\d{2}-\d{3}-lcd|ml-?one\d{3}|universal|screen)\b/i) &&
    !n.match(/\b80\+(?!\w)/i)) return 'case';
  if (n.match(/\b(boitier|bo\u00eetier|case|tower|mid.?tower|full.?tower|mini.?tower|chassis|atx\s*chassis)\b/)) return 'case';

  return null;
}

/**
 * Extracts category signals from a product URL.
 * Retailer URLs often contain highly reliable category slugs.
 */
export function inferCategoryFromUrl(url: string): Category | null {
  if (!url) return null;
  const u = url.toLowerCase();
  
  let path = u;
  try {
    const parsed = new URL(u);
    path = parsed.pathname;
  } catch {
    // fallback to full string if not a valid URL
  }

  // 1. Explicit Category Paths (Very Strong Signals based on Moroccan Retailers)
  if (path.match(/\/(ventirads?-processeur|kits-watercooling|watercooling-aio|cpu-cooler|refroidissement|cooling)\//)) return 'cooling';
  if (path.match(/\/(alimentations?(-pc)?(-psu)?|psu-.*|entre-\d+-w-et-\d+-w)\//)) return 'psu';
  if (path.match(/\/(carte-mere|cartes-meres)\//)) return 'motherboard';
  if (path.match(/\/(processeurs?)\//)) return 'cpu';
  if (path.match(/\/(cartes?-graphiques?.*|nvidia.*|amd-radeon.*)\//)) return 'gpu';
  if (path.match(/\/(dimm|memoire-vive.*|memoire-ram|ram)\//)) return 'ram';
  if (path.match(/\/(disques?-ssd|disques?-durs-et-ssd|stockage-hdd-et-ssd|ssd)\//)) return 'storage';
  if (path.match(/\/(boitiers?-pc|boitiers?-pc-.*|boitier-gamer|les-moyennes-tours|les-grandes-tours|les-mini-tours)\//)) return 'case';
  if (path.match(/\/(ventilateurs?-boitier|ventilateurs?)\//)) return 'fan';
  if (path.match(/\/(pate-thermique-pc|pate-thermique)\//)) return 'thermal_paste';

  // 2. Product Slug Signals (e.g. for /produit/alimentation-sg-550w-...)
  if (path.match(/[\/-](watercoling|watercooler|aircooler|ventirad|refroidisseur)-/)) return 'cooling';
  if (path.match(/[\/-](alimentations?|psu)-/)) return 'psu';
  if (path.match(/[\/-](carte-mere|motherboard)-/)) return 'motherboard';
  if (path.match(/[\/-](processeur|cpu)-/)) return 'cpu';
  if (path.match(/[\/-](carte-graphique|gpu)-/)) return 'gpu';
  if (path.match(/[\/-](ram|memoire)-/)) return 'ram';
  if (path.match(/[\/-](ssd|hdd)-/)) return 'storage';
  if (path.match(/[\/-](boitier|case)-/)) return 'case';
  if (path.match(/[\/-]fan-/)) return 'fan';
  if (path.match(/[\/-]pate-thermique-/)) return 'thermal_paste';

  return null;
}
