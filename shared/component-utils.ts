import { decodeHtml } from './decode-html.js';

export { decodeHtml };

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
  | 'accessory';

/**
 * Heuristic-based category inference from product names.
 */
export function inferCategory(name: string): Category | null {
  const n = name.toLowerCase();

  // 1. Operating Systems
  if (n.match(/\b(windows|microsoft\s*office|win\s*(10|11))\b/)) return 'os';

  // Early exits — products that should never be categorized as PC components
  // Bundle/kit detection: "PC Gamer AMD Ryzen 5 + RTX 4070" → null
  if (n.match(/\b(pack|bundle|kit\s*(pc|gaming)|pc\s*(gamer|gaming|complet))\b/) &&
    !n.match(/\b(case\s*bundle|boitier|hyte|fan|ventilateur|pack\s*(rgb|argb|led)|(rs|ll|ql|af|sp)\d{2,3}|f\d{2,3}|triple\s*pack|dual\s*pack|light\s*wings)\b/)) return null;
  // Laptop RAM — SO-DIMM is not compatible with desktop builds
  if (n.match(/\b(so-dimm|sodimm)\b/)) return null;
  // Generic Noise / Partial Names
  if (n.match(/\b(avec\s*dissipateur|sans\s*emballage|bulk|oem|3,5\"|tray)\b/) && n.length < 35) return null;

  // 2. Peripherals
  if (n.match(/\b(souris|mouse|logitech\s*g|deathadder|basilisk|viper|hero\s*25k)\b/) &&
    !n.match(/\b(ram|ddr[45]|go|gb|mo|mb|cpu|gpu|motherboard|psu|case|boitier|cooler|fan|ssd|hdd|nvme|m\.2)\b/)) return 'mouse';
  if (n.match(/\b(clavier|keyboard|mechanical\s*keyboard|razer\s*huntsman|logitech\s*g\d{3}|apex\b)\b/) &&
    !n.match(/\b(hyper|ak\d{3}|ag\d{3}|noctua|be\s*quiet|cooler\s*master|deepcool|arctic|thermalright)\b/)) return 'keyboard';
  if (n.match(/\b(casque|headset|headphones|hyperx\s*cloud|blackshark|arctis)\b/)) return 'headphones';
  if (n.match(/\b(haut-parleur|speakers|enceintes|logitech\s*z)\b/)) return 'speakers';
  if (n.match(/\b(webcam|c920|c922|kiyo|streamcam)\b/)) return 'webcam';
  if (n.match(/\b(écran|monitor|moniteur|gaming\s*monitor|hz|ms|ips|va|curved)\b/) && !n.match(/\b(gpu|rtx|rx|arc)\b/)) return 'monitor';

  // 3. Networking — check AFTER motherboard chipset and peripherals to avoid misclassifying
  // e.g. "MSI MAG B650 TOMAHAWK WIFI" should be motherboard, not wireless_network_adapter
  // e.g. "Razer Viper Wireless" should be mouse, not wireless_network_adapter
  if (n.match(/\b(wifi|wireless|bluetooth|pci-e\s*wifi|usb\s*wifi|antenne|antenna)\b/) &&
    !n.match(/\b([abxhz]\d{3,4}[eimdpqrsv]?|trx\d{2}[a-z]?|wrx\d{2}[a-z]?|souris|mouse|clavier|keyboard|casque|headset|headphones|webcam|monitor)\b/)) return 'wireless_network_adapter';
  if (n.match(/\b(ethernet|rj45|pci-e\s*lan|gigabit\s*lan|network\s*card)\b/)) return 'wired_network_adapter';

  // 4. Accessories & Other
  if (n.match(/\b(ups|onduleur|batterie\s*secours|battery\s*backup)\b/)) return 'ups';
  if (n.match(/\b(graveur|lecteur\s*dvd|blu-ray|optical\s*drive)\b/)) return 'optical_drive';
  if (n.match(/\b(externe|external\s*ssd|external\s*hdd|portable\s*drive|usb\s*3\.[012])\b/)) return 'external_storage';
  if (n.match(/\b(sound\s*card|carte\s*son|dac|amp)\b/) &&
    !n.match(/\b(rtx|gtx|radeon|geforce|rx\s*\d{3,4}|arc\s*[ab]\d{3})\b/)) return 'sound_card';
  if (n.match(/\b(riser|vertical\s*gpu|holder|bracket|mount|support|riser\s*cable|thermal\s*pad)\b/)) return 'case_accessory';
  // Fan hubs and controllers — must come before 'hub' generic accessory catch
  if (n.match(/\b(contrôleur\s*ventilateur|fan\s*controller|commander\s*pro|lighting\s*node|rgb\s*\&\s*fan\s*controller|fan\s*hub|fh-\d{2}|gh-\d{2}|edge\s*hub|uni\s*fan\s*hub|xh100\s*hub)\b/)) return 'fan_controller';
  if (n.match(/\b(câble|cable|adaptateur|adapter|extension|dock|frame|écran|screen)\b/)) return 'accessory';

  // 5. Core Components (Priority check to avoid miscategorization)

  // Cooling — air coolers & AIOs (generic keywords)
  // Cooling — air coolers & AIOs (generic keywords)
  if (n.match(/\b(aio|liquid\s*cooler|watercooler|watercooling|refroidissement\s*liquide|liquid\s*freezer|ventirad|refroidissement|aircooler|air\s*cooler|cpu\s*cooler|water\s*cooler|hydro\s*x|h60i|h100i|h115i|h150i|h170i|h100x|h60x|kraken|ryujin|ryuo|galahad|lq\d{3}|light\s*loop|spartacus|lb\d{3}m*|proart\s*lc|mag\s*coreliquid|mpg\s*coreliquid|connect|chione|hydroshift|hydro\s*shift|thicc\s*q\d{2}|ice-?\d{3}|ml-ultra\d{3}|symphony\s*\d{3}|waterforce\s*[x]?\s*\d{3})\b/) &&
    !n.match(/\b(case|boitier|tower|chassis|boîtier|bracket|mount)\b/)) return 'cooling';
  // Cooling — DeepCool AIO series: LD, LE, LM, LS, LT, LX + HYBROK HL-series (all AIOs)
  if (n.match(/\b(deepcool)\b/) &&
    n.match(/\b(ld|le|lm|ls|lt|lx)\d{3}\b/) &&
    !n.match(/\b(case|boitier|tower|chassis)\b/)) return 'cooling';
  if (n.match(/\b(hybrok)\b/) &&
    n.match(/\b(hl\d{3}|ld|le|lm)\d{0,3}\b/) &&
    !n.match(/\b(case|boitier|tower|chassis)\b/)) return 'cooling';
  // Cooling — Corsair Titan RX series (AIO, not a case)
  if (n.match(/\b(corsair)\b/) && n.match(/\b(titan\s*\d{3}\s*rx|hydro\s*h\d{2,3}i?)\b/)) return 'cooling';
  // Cooling — model-based: AK-series, Hyper-series, Assassin, Dark Rock, Gammaxx, VELOX, etc.
  if (n.match(/\b(ak[- ]?\d{3}[a-z]*|hyper\s*\d{3}[a-z]*|hyper\s*622|assassin|dark\s*rock|shadow\s*rock|gammaxx|arctic\s*(freezer|alpine)|ag\d{3}|ets-t[456]\d|peerless\s*assassin|phantom\s*spirit|id-?cooling|corefrozr|coreliquid|castle\s*\d{3}|ml\s*(one|lcd|ultra)|ml-?(one|lcd|ultra)|mpg\s*velox|mag\s*velox|velox\s*\d+|a30\b|a500\b|a410\b|a620\b|mystique\s*\d{3}|masterliquid\s*[plm]*\s*\d{3}l?|masterair|th\d{3}|ux\d{3}|toughair|lc\d{3}|i70|i71c|t\d{3}\s*rgb|core\s*plus)\b/) &&
    !n.match(/\b(case|boitier|tower|chassis|boîtier|bracket|gpu|motherboard|psu)\b/)) return 'cooling';

  // Cases — NZXT H-series (and Thermaltake H590 which follows the same naming)
  if (n.match(/\b(h210i?|h400i?|h440i?|h500i?|h510i?|h590\b|h700i?|h710i?|h5\s*flow|h6\s*flow|h7\s*flow|h9\s*flow|h5\s*elite|h7\s*elite|h9\s*elite|h3\s*flow|h1\s*v2)\b/)) return 'case';
  // Cases — Phanteks NV/Enthoo/Evolv series
  if (n.match(/\b(nv5|nv7|nv9|enthoo|evolv\s*[x]?)\b/)) return 'case';
  // Cases — named models from many brands
  if (n.match(/\b(o11|o11d|vision|vector|lancool|dynamic|pano|forge|gungnir|sekira|mag\s*pano|mpg\s*gungnir|mag\s*forge|mag\s*shield|m100a|120a|ap201|ap202|gt301|gt302|gt501|gt502|gr701|helios|hyperion|proart\s*pa\d*|gr701|tuf\s*gaming\s*gt|a21|a31|mc500|mc51|mc61|mca|mcmesh|mcorb|mc\d{2,3}|talos|aura\s*gc|gamdias|c8|c3|c5|c7|df800|cx300|ragnär|nightcity|biohazard|tooq|y40|y60|y70|y70\s*touch|corsair\s*air|montech\s*air|pop\s*(air|mini|silent)|define\s*(7|c|mini|r\d)|meshify\s*(2|c)|torrent|north|ridge|terra|mood|lancool|vision|morpheus|a3\b|cte\b|hummer|cmt\d+|fv150|fv235|mc-ultra|mc-custom|mcultra|light\s*base|qube\s*500|qube\s*540|masterframe|tomahawk\s*atx|tomahawk\s*itx|odyssey\s*x|t350m|465x|icue)\b/) &&
    !n.match(/\b(psu|alimentation|motherboard|mb|cpu\s*cooler|ventirad|water\s*cooler|liquid|monitor|mouse|keyboard|fan|halo|wing|light\s*wings)\b/)) return 'case';
  // Cases — Cooler Master (masterbox, mastercase, silencio, haf, td-series, masterfan excluded)
  if (n.match(/\b(masterbox|mastercase|silencio|haf\s*\d+|td\d{3}|cm\s*\d{4}[a-z]*|cmp\d{3}|elite\s*(310|330|340|350|370|430|500))\b/) &&
    !n.match(/\b(psu|alimentation|motherboard|cpu\s*cooler|ventirad|water\s*cooler|liquid|masterfan|masterliquid|fan)\b/)) return 'case';
  // Cases — Corsair (carbide, obsidian, spec-omega, crystal, icue-series, frame-series)
  if (n.match(/\b(carbide|crystal\s*\d{3}[a-z]*|obsidian|spec.omega|spec.delta|frame\s*\d{4}|icue\s*\d{4}[a-z]*(?!\s*rx)|icue\s*link\s*\d{4}|2500x|3000d|3500x|6500d|6500x|4000d|5000d|4000x|5000x)\b/) &&
    !n.match(/\b(cpu|gpu|motherboard|psu|alimentation|ram|ssd|rx|aio|water\s*cooler|liquid|fan)\b/)) return 'case';
  // Cases — Thermaltake (divider, view, level 20, core v)
  if (n.match(/\b(divider\s*\d+|view\s*\d+|level\s*20|core\s*[pvx]\d*)\b/) &&
    n.match(/\b(thermaltake|tt)\b/) &&
    !n.match(/\b(psu|alimentation|cpu\s*cooler|water\s*cooler|liquid|fan)\b/)) return 'case';
  // Cases — Mars Gaming, M.RED, HYBROK, SG, XTRMLAB, AZZA, NOX, setup game (all sell only cases)
  if (n.match(/^(mars\s*gaming|m\.red|hybrok|sg\b|xtrmlab|azza|nox\b|setup\s*game|raijintek|itek|spirit\s*of\s*gamer|havn|montech|kolink|cougar|aerocool|antec|icelil|apnx)\b/) &&
    !n.match(/\b(fan\s+pack|argb\s+fan|rgb\s+fan|\d+\s*x\s*\d+mm|triple\s*pack|dual\s*pack|fan\s*controller|hub|paste|thermal|psu|alimentation|ram|ssd|gpu|cpu|motherboard|hl\d{3}|symphony|core\s*plus|ap1-v)\b/) &&
    !n.match(/\b\d{3,4}\s*w\b/) &&
    !n.match(/\b(80plus|80\s*plus|gold|bronze|platinum|modular|watt)\b/)) return 'case';
  // Cases — specific models for Aerocool/Antec (those that don't have 'case' in name)
  if (n.match(/\b(cs-107|streak|zauron|klaw|dp301m|dp502|draco|nx360|torque|cronus|cube\s*802f|obsidian\s*270|pyramid\s*804l|jx\d{3,4})\b/)) return 'case';
  // Cases — MSI MAG Vampiric, MEG Prospect (case lines)
  if (n.match(/\b(mag\s*vampiric|meg\s*prospect|mpg\s*gungnir|msi\s*gungnir)\b/) &&
    !n.match(/\b(psu|cpu\s*cooler|water\s*cooler|fan|liquid)\b/)) return 'case';
  // Cases — DeepCool case models (CG, CH, CC, SC, Matrexx — NOT LD/LE/LM which are AIOs)
  if (n.match(/\b(deepcool)\b/) &&
    n.match(/\b(cg\d{3}|ch\d{3}|cc\d{3}|sc\d{3}|matrexx\s*\d+|quadstellar)\b/) &&
    !n.match(/\b(psu|cpu\s*cooler|water\s*cooler|fan|liquid)\b/)) return 'case';
  // Cases — Gigabyte/ASUS cases
  if (n.match(/\b(gigabyte\s*c\d{3}|asus\s*rog\s*z\d{2}|asus\s*tuf\s*gaming\s*[a-z]\d)\b/)) return 'case';

  // Cases — be quiet! (Pure Base, Shadow Base, Silent Base, Light Base)
  if (n.match(/be\s*quiet/) &&
    n.match(/\b(pure\s*base|shadow\s*base|silent\s*base|light\s*base)\b/)) return 'case';

  if (n.match(/\b(boitier|boîtier|case|tower|mid.?tower|full.?tower|mini.?tower|chassis|atx\s*chassis)\b/) &&
    !n.match(/\b(psu|alimentation|carte\s*mère|motherboard|cpu\s*cooler|ventirad|fan|ventilateur|gpu|riser|monitor)\b/)) return 'case';

  // CPU / GPU / MB / RAM
  if (n.match(/\b(ryzen|core\s*i[3579]|core\s*ultra|threadripper|xeon|athlon|pentium|celeron|processeur|processor)\b/) &&
    !n.match(/\b(paste|compound|grease|pate|pâte|cooler|refroidissement|ventirad|fan|ventilateur|case|boitier|tower|frame|bracket|monitor)\b/)) return 'cpu';

  if (n.match(/\b(rtx|gtx|radeon|rx\s*\d{3,4}|arc\s*[ab]\d{3}|geforce|quadro|firepro)\b/) &&
    !n.match(/\b(boitier|boîtier|case|tower|mid.?tower|chassis|riser|mount|holder|kit|monitor)\b/)) return 'gpu';

  if (n.match(/\b(carte\s*m[eè]re|motherboard|mobo|mb|zenith\s*[ivx]+)\b/) && !n.match(/\b(case|boitier|tower|psu|nvme|ssd)\b/)) return 'motherboard';
  if (n.match(/\b([abxhz]\d{3,4}[a-z0-9]*|trx\d{2}[a-z]?|wrx\d{2}[a-z]?|lga\d{4})\b/) &&
    !n.match(/\b(rtx|gtx|rx\s*\d{3,4}|case|boitier|tower|chassis|nzxt|kingston|a400|ddr|ram|aio|cpu\s*cooler|ventirad|monitor|fan|mouse|keyboard|nvme|ssd|cardea|z440|z540|80plus|80\s*plus|gold|bronze|platinum|titanium|watt|\d{3,4}w|pcie5|modular)\b/) &&
    // Exclude Corsair/NZXT AIOs: H60, H100, H115, H150, H170 — these are coolers not motherboards
    !n.match(/\b(corsair|nzxt)\b.*\bh\d{2,3}i?\b/) &&
    !n.match(/\bh\d{2,3}i?\s*(rgb|elite|white|black|aio|liquid|360mm|240mm|280mm)\b/) &&
    // Exclude EMTEC storage (X150, X300, etc.)
    !n.match(/\bemtec\b/) &&
    // Exclude Cooler Master upgrade kits
    !n.match(/\b(upgrade\s*kit|socket\s*kit|mounting\s*kit)\b/) &&
    // Exclude MSI MAG/MPG A-series PSUs: MAG A300N, MAG A500N, MAG A550BN, MPG A750GF, MPG A1000G, etc.
    !n.match(/\b(mag|mpg)\s+a\d{3,4}[a-z]*/) &&
    !n.match(/\ba850gls\b/)) return 'motherboard';

  // Storage
  if (n.match(/\b(nvme|m\.?2|ssd|hdd|disque\s*(dur|ssd)|hard\s*drive|solid\s*state|firecuda|barracuda|ironwolf|skyhawk|exos|wd\s*(blue|black|red|gold|purple)|sn\d{3,4}|bx\d{3}|mx\d{3}|su\d{3}|p[235]\s*\d{1,3}|legend\s*\d{3}|a400|v-series|sa\d{3}|s270|t70[05]|ns100|cs900|cs1030|cs2130|cs2140|dc\d{3}m?|mp\d{3}|intenso|ultrastar|mg08|mg\s*series|wd\d{2}[a-z]{4}|a55|gx2|kc\d{4}|spatium|nq100|hiksemi|fanxiang|s101|s300|s300\s*pro|n300\s*nas|surveillance\s*3\.5|990\s*pro|980\s*pro|970\s*evo|870\s*evo|qvo|cardea|zero\s*z\d{3}|sata\s*iii|2\.5\s*tray|sata\s*2\.5|vi\d{3,4})\b/) &&
    !n.match(/\b(cpu\s*cooler|ventirad|fan|ventilateur|motherboard|carte\s*mère|mb|socket|case|psu|monitor)\b/) &&
    !n.match(/\b([abxhz][1-9]10|[abxhz][1-9]70|[abxhz][1-9]90)\b/)) return 'storage';
  // Storage — common SSD brands that often lack 'ssd' keyword
  if (n.match(/\b(sandisk|netac|kingspec|timetec|twinmos|hiksemi|fanxiang)\b/) &&
    n.match(/\b(\d+(go|gb|tb|to))\b/) &&
    !n.match(/\b(ram|memoire|motherboard|case|psu)\b/)) return 'storage';
  // Storage — Toshiba NAS/surveillance/enterprise drives (explicit brand+type)
  if (n.match(/\b(toshiba)\b/) &&
    n.match(/\b(s300|n300|mg0[0-9]|p300|surveillance|enterprise|capacity|nas|\d+\s*tb|\d+\s*to)\b/)) return 'storage';
  // Storage — WD NAS/Red/Purple (not caught by generic ssd/hdd keywords)
  if (n.match(/\b(western\s*digital|wd)\b/) &&
    n.match(/\b(red|purple|gold|nas|cmr|smr|\d+\s*tb|\d+\s*to)\b/) &&
    !n.match(/\b(case|cooler|fan|psu|motherboard)\b/)) return 'storage';

  // PSU
  if ((n.match(/\b\d{2,5}\s*w\b/) || n.match(/\b(ai\d{4}t|a\d{3,4}gs?|a\d{3,4}gls?|a\d{3,4}g|80plus|80\s*plus|mwe|smart|anima|elite|mag\s*a\d{3,4}|mpg\s*a\d{3,4}|p[567]50ss|pl\d{3}-d|px\d{3,4}-?[pg]|bn\d{3}|rm\d{3,4}[eix])\b/)) &&
    n.match(/\b(alimentation|psu|power\s*supply|gold|platinum|titanium|bronze|silver|white|ice|modular|80\s*plus|80plus|atx\s*3|semi.?mod|full.?mod|watt|\d{2,5}\s*w|ai\d{4}t|a\d{3,4}gs?|a\d{3,4}gls?|a\d{3,4}g|mwe|smart|anima|elite|rm\d{3,4}[eix]|pl\d{3}-d|px\d{3,4}-?[pg])\b/) &&
    !n.match(/\b(case|boitier|tower|motherboard|mb|socket|cpu\s*cooler|water\s*cooler|refroidissement|[abxhz]\d{3,4}|fan|gpu)\b/)) return 'psu';
  // MSI MAG/MPG A-series PSUs: MAG A300N-H, MAG A500N-H, MAG A550BN, MPG A750GF, MPG A1000G, etc.
  // These match the motherboard chipset regex but are clearly PSUs from the naming scheme.
  // Also catches A850GLS MLG (no MAG/MPG prefix but same PSU line).
  if (n.match(/\b(mag|mpg)\s+a\d{3,4}[a-z]*/)) return 'psu';
  if (n.match(/\ba850gls\b/)) return 'psu';

  // Fans & Paste
  if (n.match(/\b(kryonaut|conductonaut|hydronaut|aeronaut|duronaut|carbonaut|kryosheet|polartherm|tm30|kryofuze|cryofuze|minus\s*pad|wipes|thermal\s*paste|pâte\s*thermique|pate\s*thermique|thermal\s*compound|thermal\s*grease|mx-[0-9]|mx[0-9])\b/) &&
    !n.match(/\b(cpu|gpu|ram|ssd|nvme|psu|case|boitier|tower|fan)\b/)) return 'thermal_paste';

  if (n.match(/\b(f120|f140|ll\d{3}|ql\d{3}|fd12|fd14|fk120|sickleflow|sicklefan|tl-c12|tl-c14|af\d{3}|sp\d{3}|rs\d{3}|ar\d{3}|ml\d{3}|rs140|rs120|ar120|ar140|f360|f420|fd14|xlf120|xt120|kunai|p12|p14|fl12r|fl12\b|fl14\b|masterfan|halo|light\s*wings|silent\s*wings|f\d{3}p|f\d{3}q|f\d{3}rgb|p\d{2}\s*max|rgb\s*core|twin\s*pack|triple\s*pack|dual\s*pack|lx\d{2,3})\b/) &&
    !n.match(/\b(aio|liquid|radiator|cpu\s*cooler|water\s*cooler|ventirad|case|boitier|tower|motherboard|mb|socket|gpu)\b/)) return 'fan';

  // 6. RAM
  if (n.match(/\b(dimm|ddr[2-5]|sdram|lpx|vengeance|dominator|trident|ripjaws|fury|beast|renegade|vengance|t-force|t-create|delta\s*rgb|vulcan|zeus|expert|flare\s*x|elite\s*plus|elite\s*ii|gaming\s*ram|memory\s*module|m\u00e9moire\s*ram|mémoire\s*ram)\b/) &&
    !n.match(/\b(motherboard|psu|case|boitier|tower|cpu|gpu|storage|ssd|nvme|hdd|fan|cooler)\b/) &&
    !n.match(/\b[abxhz]\d{3,4}[eimdpqrsv]?\b/)) return 'ram';

  // 7. Secondary Cooling Models — brand + cooler model keyword
  if (n.match(/\b(noctua|deepcool|arctic|thermalright|scythe|id.?cooling|be\s*quiet|asus|msi|gigabyte|nzxt|fractal|lian\s*li|phanteks|corsair|cooler\s*master|xtrmlab)\b/) &&
    n.match(/\b(nh|ak|lc|le|se|sl|bk|dk|sk|ld|ls|lm|lf|lp|lx|pure|shadow|dark|silent|freezer|liquid|frozen|peerless|phantom|spirit|assassin|burst|notus|frost|maelstrom|ryujin|ryuo|kraken|galahad|lq\d{3}|nautilus|coreliquid|hyper\s*\d{3}|hyper\s*212|gammaxx|castle|arctic|v4\s*alpha|ml\d{3}[a-z]*|nex\s*\d{3}|helix|galax)\b/) &&
    !n.match(/\b(case|boitier|tower|chassis|boîtier|gpu|motherboard|mb|socket|psu|fan|halo|masterfan|3000d|4000d|5000d|6500d|carbide|obsidian|kryofuze)\b/)) return 'cooling';

  return null;
}

export function extractBrand(name: string): string {
  const n = name.trim();
  const lower = n.toLowerCase();

  // 1. Explicit sub-brand to parent brand mapping
  const SUB_BRANDS: Record<string, string> = {
    'rog': 'ASUS', 'tuf': 'ASUS', 'strix': 'ASUS', 'proart': 'ASUS', 'prime': 'ASUS',
    'mpg': 'MSI', 'mag': 'MSI', 'meg': 'MSI', 'optix': 'MSI',
    'aorus': 'Gigabyte', 'gaming oc': 'Gigabyte', 'eagle': 'Gigabyte', 'windforce': 'Gigabyte',
    'masterliquid': 'Cooler Master', 'masterbox': 'Cooler Master', 'masterfan': 'Cooler Master', 'hyper': 'Cooler Master',
    'vengance': 'Corsair', 'dominator': 'Corsair', 'icue': 'Corsair', 'hydroshift': 'Lian Li', 'titan': 'Corsair',
    'trident': 'G.Skill', 'ripjaws': 'G.Skill',
    'fury': 'Kingston', 'renegade': 'Kingston',
    'sn550': 'WD', 'sn570': 'WD', 'sn580': 'WD', 'sn770': 'WD', 'sn850': 'WD',
    '970 evo': 'Samsung', '980 pro': 'Samsung', '990 pro': 'Samsung'
  };

  for (const [sub, parent] of Object.entries(SUB_BRANDS)) {
    if (lower.includes(sub)) return parent;
  }

  // 2. Search for major brands anywhere in the name (not just at the start)
  const BRANDS = ['AMD', 'Intel', 'NVIDIA', 'ASUS', 'MSI', 'Gigabyte', 'ASRock', 'EVGA', 'Corsair', 'G.Skill', 'Kingston', 'Crucial', 'TeamGroup', 'Team Group', 'Lexar', 'ADATA', 'Samsung', 'WD', 'Seagate', 'Sabrent', 'Silicon Power', 'Seasonic', 'be quiet!', 'Cooler Master', 'Thermaltake', 'Antec', 'DeepCool', 'Fractal', 'NZXT', 'Lian Li', 'Phanteks', 'Aerocool', 'Silverstone', 'Noctua', 'Arctic', 'Thermalright', 'Scythe', 'ID-Cooling', 'APNX', 'Arktek', 'Inno3D', 'Palit', 'Zotac', 'Sapphire', 'PowerColor', 'XFX', 'PNY', 'Gainward', 'Colorful', 'Galax', 'KFA2', 'Acer', 'HP', 'Toshiba', 'Patriot', 'Klevv', 'Geil', 'Mushkin', 'FSP', 'Super Flower', 'XPG', 'Cougar', 'Chieftec', 'LC Power', '1stPlayer', 'Kolink', 'Sharkoon', 'BitFenix', 'Mars Gaming', 'M.RED', 'Enermax', 'Xigmatek', 'Montech', 'Biostar', 'Verbatim', 'Abkoncore', 'XTRMLAB', 'OCPC', 'HIKSEMI', 'FANXIANG', 'Setup Game', 'Hyte', 'Yeyian', 'HAVN', 'Itek', 'Spirit of Gamer', 'Western Digital', 'Razer', 'Innovation IT', 'Viper'];

  for (const brand of BRANDS) {
    const bLower = brand.toLowerCase();
    // Check for word boundary match, but handle special characters like !
    const escapedBrand = bLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = bLower.includes('!')
      ? new RegExp(`\\b${escapedBrand}`, 'i')
      : new RegExp(`\\b${escapedBrand}\\b`, 'i');
    if (regex.test(lower)) return brand;
  }

  // No brand found
  return '';
}

/**
 * Standard category keywords used for stripping prefixes/suffixes.
 */
export const CATEGORY_WORDS = new Set([
  'boitier', 'boîtier', 'boitiers', 'boîtiers',
  'watercooler', 'watercooling',
  'processeur', 'processeurs',
  'carte graphique', 'cartes graphiques',
  'alimentation', 'alimentations',
  'stockage',
  'memoire', 'mémoire', 'memoires', 'mémoires',
  'aircooler', 'air cooler',
  'carte mère', 'carte mere', 'cartes mères', 'cartes meres',
  'disque', 'disques',
  'pate thermique', 'pâte thermique'
]);

export function cleanName(rawName: string, brand: string): string {
  let name = decodeHtml(rawName);

  // Strip French Retail prefixes
  name = name
    .replace(/l['\u2019]alimentation\s+/gi, '')
    .replace(/le\s+processeur\s+/gi, '')
    .replace(/les\s+processeurs\s+/gi, '')
    .replace(/la\s+carte\s+graphique\s+/gi, '')
    .replace(/les\s+cartes\s+graphiques\s+/gi, '')
    .replace(/la\s+carte\s*m[eè]re\s+/gi, '')
    .replace(/les\s+cartes\s*m[eè]re\s+/gi, '')
    .replace(/carte\s*m[eè]re\s+/gi, '');

  // Strip leading em-dash prefix (retailer category prefix artifact)
  // e.g. "– Matrexx 55 V3" → "Matrexx 55 V3"
  name = name.replace(/^[–\-]\s+/, '');

  // Strip SKU codes appended after pipe
  // e.g. "AddGame Spider S5 16GB ... | AG16GB56C40S5UB" → "AddGame Spider S5 16GB ..."
  name = name.replace(/\s*\|.*$/, '').trim();

  // Strip category prefix patterns (handle both "Category - Name" and "Category Name")
  name = name
    .replace(/^(processeurs?|cartes?\s*graphiques?|cartes?\s*m[eè]res?|m[eé]moires?\s*vives?|disques?\s*durs?|alimentations?|[Bb]oîtiers?|refroidissement|ventilateurs?\s*boîtier|p[âa]tes?\s*thermique)\s*[\-–]\s+/gi, '')
    .replace(/^(processeurs?|cartes?\s*graphiques?|cartes?\s*m[eè]res?|m[eé]moires?\s*vives?|disques?\s*durs?|alimentations?|[Bb]oîtiers?|refroidissement|ventilateurs?\s*boîtier|p[âa]tes?\s*thermique)\s+/gi, '');

  // Strip category breadcrumb suffixes appended by retailers (UltraPC, NextLevel, etc.)
  // e.g. "Ryzen 5 5600XTProcesseurs" → "Ryzen 5 5600XT"
  //      "GeForce RTX 4090 GAMING OC 24GB GDDR6X Cartes graphiques" → "GeForce RTX 4090 GAMING OC 24GB GDDR6X"
  //      "FURY Beast 32Go DDR5 Mémoire vive" → "FURY Beast 32Go DDR5"
  //      "Barracuda 1 To Disques durs et SSD" → "Barracuda 1 To"
  name = name
    .replace(/Processeurs?\s*$/gi, '')
    .replace(/Cartes?\s*[Gg]raphiques?\s*$/gi, '')
    .replace(/Cartes?\s*[Mm][eè]res?\s*$/gi, '')
    .replace(/M[eé]moire\s*[Vv]ive\s*(PC|DDR[45])?\s*\w*\s*$/gi, '')
    .replace(/Disques?\s*(durs?\s*(et\s*SSD)?|SSD)\s*\w*\s*$/gi, '')
    .replace(/Alimentations?\s*(PC)?\s*\w*\s*$/gi, '')
    .replace(/[Bb]oîtiers?\s*(PC|[Gg]amer)?\s*\w*\s*$/gi, '')
    .replace(/Refroidissement\s*$/gi, '')
    .replace(/Ventilateurs?\s*[Bb]oîtier\s*\w*\s*$/gi, '')
    .replace(/P[âa]te\s*[Tt]hermique\s*$/gi, '')
    // UltraPC appends ", Ultra Pc Gamer Maroc" to alt text
    .replace(/,?\s*Ultra\s*Pc\s*Gamer\s*Maroc\s*$/gi, '')
    // SetupGame appends "Setup Game" or "Setup-Game" branding
    .replace(/\s*[-–]\s*Setup\s*Game\s*\w*\s*$/gi, '')
    .replace(/\s*Setup\s*Game\s*\w*\s*$/gi, '');

  // Strip marketing/promo noise at the start
  name = name.replace(/^(PROMO\s*!+\s*|SOLDES?\s*!+\s*|NEW\s*!+\s*)/gi, '');

  // Strip marketing noise in parentheses anywhere
  name = name.replace(/\s*\((Livraison\s*Gratuite|Promo|Solde|New|Nouveau|Gratuit)[^)]*\)\s*/gi, ' ');

  // Remove brand if present (handles double-brand like "AMD AMD Ryzen")
  if (brand) {
    const bRegex = new RegExp(`\\b(${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|processeur)\\b`, 'gi');
    name = name.replace(bRegex, '');
    // Run twice to catch double-brand (e.g. "AMD AMD Ryzen" → " AMD Ryzen" → " Ryzen")
    name = name.replace(bRegex, '');
  }

  // Remove retail noise + Colors + Technical specs
  name = name
    .replace(/\s*(BOX|Tray|MPK|OEM|Bulk|no\s*fan|WOF|wraith\s*\w+|edition|noir|blanc|white|black|silver|argent|grey|gris|sans\s*emballage|sans\s*refroidisseur|avec\s*dissipateur(\s*thermique)?)\s*/gi, ' ')
    .replace(/\s*\(\s*\)\s*/g, ' ') // Strip empty parentheses
    // French marketing phrases: (jusqu'à 4.7 GHz), (jusqu\u2019à 4.7 GHz), (jusqu'à 4,7 GHz) — comma decimal variant
    .replace(/\s*\(jusqu['\u2019]?\u00e0?\s*[\d.,]+\s*GHz\)\s*/gi, ' ')
    .replace(/\s*\(jusqu['\u2019]?\u00e0?\s*[\d.,]+\s*GHz[^)]*\)\s*/gi, ' ')
    .replace(/\s*\(\d+\.?\d*\s*GHz\s*\/\s*\d+\.?\d*\s*GHz\)\s*/gi, '') // (3.7 GHz / 4.6 GHz)
    .replace(/\s*\(\d+\.?\d*\s*GHz[^)]*\)\s*/gi, '') // (3.7 GHz Max)
    .replace(/\s*\(\d+\.?\d*\s*GHz[^)]*\.{3}?\s*/gi, '') // (3.7 GHz /... truncated — no closing paren
    .replace(/\s*\(\d+\.?\d*\s*GHz[^)]*$/, '') // (3.7 GHz... at end of string with no closing paren
    .replace(/\s+\d+\.?\d*\s*GHz\s*\/\s*\d+\.?\d*\s*GHz\s*/gi, ' ') // 3.7 GHz / 4.6 GHz
    .replace(/\s+\d+\s*(MHZ|GHZ|mhz|ghz)\s*$/i, '') // Trailing MHz/GHz
    .replace(/\s*-\s*ed\s*$/i, '') // "- ed" suffix
    // Strip trailing ellipsis from truncated scraper names
    .replace(/\s*\.{2,}\s*$/, '')
    // Strip spec text appended after em-dash: "– 32 Cœurs / 64 threads", "– 8 Cœurs"
    .replace(/\s*[–\-]\s*\d+\s*[Cc][œo]urs?.*$/i, '')
    // Compatibility info in parens: (Micro ATX), (Mini ITX), (LGA1700)
    .replace(/\s*\((Micro\s*ATX|Mini\s*ITX|ATX|ITX|LGA\d+|AM[45])\)\s*/gi, ' ')
    // Souris Gaming / Clavier Gaming suffixes
    .replace(/\s*\((Souris|Clavier|Casque|Écran)\s*Gaming\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize Intel CPU model names:
  // "Core i3-10100F" → "Core i3 10100F"
  // "i3-10100F" → "Core i3 10100F"  (add missing "Core" prefix)
  // "I7-9700" → "Core i7 9700"
  name = name.replace(/\b(Core\s+(?:Ultra\s+)?i\d|i\d)-(\d)/gi, '$1 $2');
  // Add "Core" prefix to bare iX names (e.g. "i7 9700" → "Core i7 9700")
  name = name.replace(/^(i\d)\s+(\d)/i, 'Core $1 $2');
  name = name.replace(/^(I\d)-(\d)/i, 'Core $1 $2');

  // Strip DDR4/DDR5 suffix from motherboard names — redundant since RAM type
  // is shown as a separate spec. Keep only if it's the only differentiator
  // between two otherwise identical names (handled by dedup logic).
  // Pattern: trailing " DDR4", " DDR5", " D4", " D5" (case-insensitive)
  name = name.replace(/\s+DDR[45]\s*$/i, '');
  name = name.replace(/\s+D[45]\s*$/i, '');

  // Strip socket suffix leaked from retailer names: "Ryzen 5 5600Socket AM4", "Core Ultra 5 225FSocket 1851"
  name = name.replace(/\s*Socket\s*(AM[45]|LGA\s*\d{4}|\d{4})\s*$/i, '');
  name = name.replace(/\s*(AM[45]|LGA\d{4})\s*$/i, '');

  // Normalize all-caps names: "RYZEN 3 3300X" → "Ryzen 3 3300X"
  // Only apply if the name is mostly uppercase (>60% uppercase letters)
  const letters = name.replace(/[^a-zA-Z]/g, '');
  const upperCount = (name.match(/[A-Z]/g) || []).length;
  if (letters.length > 3 && upperCount / letters.length > 0.6) {
    name = name.toLowerCase().replace(/\b(\w)/g, (c) => c.toUpperCase());
  }

  // If after stripping everything it's empty, use the original (fallback)
  if (name.length < 2) name = rawName;

  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ── Dummy spec extractors (to satisfy imports) ──
// ── Real spec extractors ──

export const extractCpuSpecs = (n: string) => {
  const socketMatch = n.match(/\b(LGA\s*1700|LGA\s*1851|AM[45]|LGA\s*1200|LGA\s*1151)\b/i);
  const tdpMatch = n.match(/\b(\d+)\s*W\b/i);

  // Infer socket from CPU model series when not explicit in name
  let socket = socketMatch ? socketMatch[1].toUpperCase().replace(/\s+/, '') : null;
  if (!socket) {
    const lower = n.toLowerCase();
    // AMD AM5: Ryzen 7000/8000/9000 series, Ryzen AI 300, Ryzen PRO 7000+
    if (lower.match(/ryzen\s+[3579]\s+[789]\d{3}/) || lower.match(/ryzen\s+ai\s+3\d{2}/) ||
      lower.match(/ryzen\s+[3579]\s+pro\s+[789]\d{3}/)) socket = 'AM5';
    // AMD AM4: Ryzen 1000-5000 series, Athlon 3000G, Ryzen PRO 3000-5000
    else if (lower.match(/ryzen\s+[3579]\s+[1-5]\d{3}/) || lower.match(/athlon\s+3\d{3}g/) ||
      lower.match(/ryzen\s+[3579]\s+pro\s+[1-5]\d{3}/)) socket = 'AM4';
    // Intel LGA1851: Core Ultra 200 series (Arrow Lake) — 2xx, 265K, 285K, etc.
    else if (lower.match(/core\s+ultra\s+\d+\s+2\d{2}[a-z]*/)) socket = 'LGA1851';
    // Intel LGA1700: Core Ultra 100 series (Meteor Lake) + Core 12th/13th/14th gen
    else if (lower.match(/core\s+ultra\s+\d+\s+1\d{2}[a-z]*/) || lower.match(/core\s+[iu]\d\s+1[234]\d{3}/)) socket = 'LGA1700';
    // Intel LGA1200: Core 10th/11th gen (10xxx, 11xxx)
    else if (lower.match(/core\s+[iu]\d\s+1[01]\d{3}/)) socket = 'LGA1200';
    // Intel LGA1151: Core 8th/9th gen (8xxx, 9xxx)
    else if (lower.match(/core\s+[iu]\d\s+[89]\d{3}/)) socket = 'LGA1151';
    // Threadripper PRO
    else if (lower.match(/threadripper\s+pro\s+[7]\d{3}/)) socket = 'sTR5';
    else if (lower.match(/threadripper\s+pro\s+[35]\d{3}/)) socket = 'sWRX8';
    // Threadripper
    else if (lower.match(/threadripper\s+[57]\d{3}/)) socket = 'sTR5';
    else if (lower.match(/threadripper\s+[34]\d{3}/)) socket = 'sTRX4';
  }

  return {
    socket,
    tdp: tdpMatch ? parseInt(tdpMatch[1]) : null
  };
};

export const extractGpuSpecs = (n: string) => {
  const lengthMatch = n.match(/\b(\d{3})\s*mm\b/i);
  return {
    length_mm: lengthMatch ? parseInt(lengthMatch[1]) : 300, // default if missing
    tdp: n.includes('4090') ? 450 : n.includes('4080') ? 320 : 200
  };
};

export const extractRamSpecs = (n: string) => {
  const typeMatch = n.match(/\b(DDR[45])\b/i);
  const freqMatch = n.match(/\b(\d{4})\s*MHz\b/i);
  return {
    ram_type: typeMatch ? typeMatch[1].toUpperCase() : (n.toLowerCase().includes('ddr5') ? 'DDR5' : 'DDR4'),
    frequency_mhz: freqMatch ? parseInt(freqMatch[1]) : (n.toLowerCase().includes('ddr5') ? 5200 : 3200)
  };
};

export const extractStorageSpecs = (n: string) => ({
  interface_type: n.toLowerCase().includes('nvme') ? 'NVMe' : 'SATA'
});

// ── Motherboard chipset → socket + DDR type lookup table ─────────────────────
//
// Rules:
//   - DDR4_ONLY: chipset only ever shipped with DDR4 slots
//   - DDR5_ONLY: chipset only ever shipped with DDR5 slots
//   - BOTH: manufacturer sold DDR4 and DDR5 variants of the same board model.
//     In this case we rely on the product name: if it contains "D4" or "DDR4"
//     → DDR4; if it contains "D5" or "DDR5" → DDR5; otherwise → DDR5 (the
//     default/newer variant that ships without a suffix).
//
// Sources: Intel ARK, AMD product pages, PCPartPicker chipset specs.

type DdrPolicy = 'DDR4_ONLY' | 'DDR5_ONLY' | 'BOTH';

interface ChipsetInfo {
  socket: string;
  ddr: DdrPolicy;
  /** Default max XMP/EXPO frequency when we can't read it from the name */
  defaultMaxMhz: number;
}

const CHIPSET_MAP: Record<string, ChipsetInfo> = {
  // ── AMD AM4 (DDR4 only) ───────────────────────────────────────────────────
  A320: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  A520: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 4600 },
  B350: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  B450: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 4400 },
  B550: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 5100 },
  X370: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  X470: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3600 },
  X570: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 5100 },
  // ── AMD AM5 (DDR5 only) ───────────────────────────────────────────────────
  A620: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  A850: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  B650: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  B650E: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  B840: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  B850: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  X570S: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 5100 }, // refresh of X570
  X670: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  X670E: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  X870: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  X870E: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  // ── AMD Threadripper ─────────────────────────────────────────────────────
  TRX40: { socket: 'sTRX4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  TRX50: { socket: 'sTR5', ddr: 'DDR5_ONLY', defaultMaxMhz: 5600 },
  WRX80: { socket: 'sWRX8', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  WRX90: { socket: 'sWRX9', ddr: 'DDR5_ONLY', defaultMaxMhz: 5600 },
  X399: { socket: 'TR4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  // ── Intel LGA1151 (8th/9th gen, DDR4 only) ───────────────────────────────
  B360: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2666 },
  B365: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2666 },
  H310: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2400 },
  H370: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2666 },
  Z370: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 4000 },
  Z390: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 4266 },
  // ── Intel LGA1200 (10th/11th gen, DDR4 only) ─────────────────────────────
  B460: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 2933 },
  B560: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 4800 },
  H410: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 2933 },
  H470: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 2933 },
  H510: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  H570: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  Z490: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 4800 },
  Z590: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 5333 },
  // ── Intel LGA1700 (12th/13th/14th gen — DDR4 and DDR5 variants exist) ────
  B660: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 4800 },
  B760: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 5600 },
  H610: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 4800 },
  H670: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 4800 },
  H770: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 5600 },
  Z690: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 6400 },
  Z790: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 7200 },
  // ── Intel LGA1851 (Core Ultra 200 series) — DDR5 only ────────────────────
  H810: { socket: 'LGA1851', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  B860: { socket: 'LGA1851', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  Z890: { socket: 'LGA1851', ddr: 'DDR5_ONLY', defaultMaxMhz: 9200 },
};

/**
 * Extract socket, supported_ram_types, and max_ram_frequency from a motherboard
 * product name using a two-layer approach:
 *
 *   Layer 1 — Explicit DDR suffix in name (highest confidence):
 *     "B760M DS3H DDR4" → DDR4,  "B760M DS3H DDR5" → DDR5
 *
 *   Layer 2 — Chipset lookup table:
 *     B650 → AM5 + DDR5_ONLY,  Z790 → LGA1700 + BOTH
 *     For BOTH chipsets: name contains "D4"/"DDR4" → DDR4, else → DDR5
 *
 * Returns null only if no chipset can be identified at all.
 */
export function inferMotherboardSpecs(name: string): {
  socket: string | null;
  supported_ram_types: string[];
  max_ram_frequency: number;
} | null {
  const upper = name.toUpperCase();

  // ── Layer 1: explicit DDR suffix anywhere in the name ────────────────────
  const hasExplicitDdr4 = /\bDDR4\b/.test(upper) || /\bD4\b/.test(upper);
  const hasExplicitDdr5 = /\bDDR5\b/.test(upper) || /\bD5\b/.test(upper);

  // ── Extract chipset token ─────────────────────────────────────────────────
  // Match patterns like: B650, B650E, B650M, X670E, Z790, H610M, X570S, TRX40, WRX80, X399
  // The chipset is always the first [ABXZH]\d{3} or TRX/WRX token in the name.
  // We strip trailing form-factor/variant letters to get the base chipset.
  const chipsetMatch = upper.match(
    /\b(TRX\d{2}|WRX\d{2}|X399|[ABXZH]\d{3}(?:[EIM]|S(?=\b))?)\b/
  );
  if (!chipsetMatch) {
    // Named series fallback: ROG MAXIMUS XII/XIII → Z490/Z590, Zenith II → TRX40
    if (/MAXIMUS\s+XII\b/.test(upper)) return inferMotherboardSpecs('Z490');
    if (/MAXIMUS\s+XIII\b/.test(upper)) return inferMotherboardSpecs('Z590');
    if (/ZENITH\s+II\b/.test(upper)) return inferMotherboardSpecs('TRX40');
    // Biostar boards with non-standard suffixes: A520MH, A520MHP, B450MH, B760MX2-E, H310CM, H610MHP
    // The chipset is the first [ABXZH]\d{3} token — strip all trailing letters/digits
    const biostarMatch = upper.match(/\b([ABXZH]\d{3})/);
    if (biostarMatch) return inferMotherboardSpecs(biostarMatch[1]);
    // ASUS Pro WS WRX80E / WRX90E — workstation boards
    if (/WRX80/.test(upper)) return inferMotherboardSpecs('WRX80');
    if (/WRX90/.test(upper)) return inferMotherboardSpecs('WRX90');
    return null;
  }

  const rawChipset = chipsetMatch[1]; // e.g. "B650E", "Z790", "H610M", "X570S"

  // Look up in map — try exact match first, then strip trailing form-factor
  // suffixes: E (enhanced), I (ITX), M (micro-ATX), S (silent/slim) are not
  // always chipset identifiers — strip them if no exact match found
  const info: ChipsetInfo | undefined =
    CHIPSET_MAP[rawChipset] ??
    CHIPSET_MAP[rawChipset.replace(/[EIM]$/, '')] ??
    CHIPSET_MAP[rawChipset.replace(/[EIMS]{1,2}$/, '')];

  if (!info) return null;

  // ── Resolve DDR type ──────────────────────────────────────────────────────
  let ramTypes: string[];
  let maxMhz: number;

  if (info.ddr === 'DDR4_ONLY') {
    ramTypes = ['DDR4'];
    maxMhz = info.defaultMaxMhz;
  } else if (info.ddr === 'DDR5_ONLY') {
    ramTypes = ['DDR5'];
    maxMhz = info.defaultMaxMhz;
  } else {
    // BOTH — use explicit suffix if present, otherwise default to DDR5
    if (hasExplicitDdr4) {
      ramTypes = ['DDR4'];
      maxMhz = info.defaultMaxMhz;
    } else {
      // DDR5 variant (either explicit DDR5 or no suffix = newer default)
      ramTypes = ['DDR5'];
      maxMhz = info.defaultMaxMhz;
    }
  }

  // Layer 1 can override the chipset default for edge cases
  // (e.g. a board name that explicitly says DDR4 on a normally DDR5 chipset)
  if (hasExplicitDdr4 && ramTypes[0] !== 'DDR4') {
    ramTypes = ['DDR4'];
  } else if (hasExplicitDdr5 && ramTypes[0] !== 'DDR5') {
    ramTypes = ['DDR5'];
  }

  return {
    socket: info.socket,
    supported_ram_types: ramTypes,
    max_ram_frequency: maxMhz,
  };
}

export const extractMotherboardSpecs = inferMotherboardSpecs;

export const extractPsuSpecs = (n: string) => {
  const wMatch = n.match(/\b(\d{3,4})\s*W\b/i);
  return { wattage: wMatch ? parseInt(wMatch[1]) : 750 };
};

export const extractCoolingSpecs = (n: string) => {
  const tdpMatch = n.match(/\b(\d+)\s*W\b/i);
  return { tdp: tdpMatch ? parseInt(tdpMatch[1]) : 200 };
};

export const extractCaseSpecs = (n: string) => {
  const lengthMatch = n.match(/\b(\d{3})\s*mm\b/i);
  return { max_gpu_length_mm: lengthMatch ? parseInt(lengthMatch[1]) : 350 };
};

export const extractFanSpecs = (n: string) => {
  const sizeMatch = n.match(/\b(80|92|120|140|200)\s*mm\b/i);
  const tripleMatch = /\b(triple|3.?pack|3x)\b/i.test(n);
  const dualMatch = /\b(dual|twin|2.?pack|2x)\b/i.test(n);
  return {
    size_mm: sizeMatch ? parseInt(sizeMatch[1]) : 120,
    rgb: /\b(rgb|argb)\b/i.test(n),
    pack_size: tripleMatch ? 3 : dualMatch ? 2 : 1
  };
};

export const extractThermalPasteSpecs = (n: string) => {
  const weightMatch = n.match(/\b(\d+(?:\.\d+)?)\s*(?:grammes?|g)\b/i);
  const isLiquidMetal = /\b(conductonaut|liquid metal)\b/i.test(n);
  const isPad = /\b(carbonaut|kryosheet|pad)\b/i.test(n);
  return {
    weight_grams: weightMatch ? parseFloat(weightMatch[1]) : 4,
    paste_type: isLiquidMetal ? 'liquid_metal' : isPad ? 'pad' : 'paste'
  };
};
