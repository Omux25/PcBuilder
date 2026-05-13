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
  | 'build';

/**
 * Heuristic-based category inference from product names.
 */
export function inferCategory(name: string): Category | null {
  const n = name.toLowerCase();
  // 0. Bundles (High priority to avoid category bleed)
  if (n.match(/\b(hydro\s*x|pacific\s*c\d{3}|pacific\s*cl\d{3}|liquid\s*freezer\s*[ivx]+\s*pro)\b/) ||
    (n.match(/\bkit\b/) && n.match(/\b(watercooling|refroidissement\s*liquide|aio)\b/) && n.match(/\b(thermaltake|lian\s*li|corsair|arctic|cooler\s*master|msi|asus|nzxt)\b/)) ||
    ((n.match(/\b(with|incl|inclus|bundle|pack)\b/) || (n.match(/\+/) && !n.match(/80\+/)) || (n.match(/\s\+\s/) && n.match(/\bpsu\b/))) && n.match(/\b(fan|psu|gpu|cpu|case)\b/) && (n.match(/\b(bundle|pack)\b/) || n.match(/\+/)))) return 'bundle' as any;

  // 1. Operating Systems
  if (n.match(/\b(windows|microsoft\s*office|win\s*(10|11))\b/)) return 'os';

  // Early exits — products that should never be categorized as PC components
  // Bundle/kit detection: "PC Gamer AMD Ryzen 5 + RTX 4070" → 'build'
  if (n.match(/\b(pack|bundle|kit\s*(pc|gaming)|pc\s*(gamer|gaming|complet|monté))\b/) &&
    !n.match(/\b(case\s*bundle|boitier|boîtier|boitiers|bo\u00eetiers|hyte|fan|ventilateur|ventilateurs|pack\s*(de\s*\d+|\d+|rgb|argb|led)|(rs|ll|ql|af|sp)\d{2,3}|f\d{2,3}|triple\s*pack|dual\s*pack|light\s*wings|ram|memory|ddr\d|ssd|hdd|cpu|gpu|psu|motherboard|carte mère)\b/)) return 'build';
  // Explicitly catch combinations that imply a full build (e.g. "Ryzen 7 + RTX 4070 + 32GB")
  const cpuSignals = [/\bryzen/i, /\bcore\s+i/i, /\bcore\s+ultra/i, /\bthreadripper/i, /\bxeon\b/i, /\bi[3579]-\d/i, /\b[ri][3579]\b/i];
  const gpuSignals = [/\brtx/i, /\bgtx/i, /\bradeon/i, /\brx\s*\d/i, /\bquadro\b/i, /\bfirepro\b/i, /\bpro\s*(6|5)000\b/i, /\bvega\b/i, /\biris\b/i, /\buhd\s*graphics\b/i];
  if (cpuSignals.some(r => r.test(n)) && gpuSignals.some(r => r.test(n))) return 'build';
  if (n.match(/\b(workstation|station\s*de\s*travail|pc\s*professionnel)\b/) && cpuSignals.some(r => r.test(n))) return 'build';

  if (n.match(/\bryzen\b/i) && n.match(/\brtx\b/i) && n.match(/\b(gb|go)\b/i) && !n.match(/\b(motherboard|carte mère|gpu|ram|ssd|hdd)\b/i)) return 'build';
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
  if (n.match(/\b(\u00e9cran|monitor|moniteur|gaming\s*monitor|hz|ms|ips|va|curved)\b/) && !n.match(/\b(gpu|rtx|rx|arc)\b/)) return 'monitor';

  // 3. Networking — check AFTER motherboard chipset and peripherals to avoid misclassifying
  // e.g. "MSI MAG B650 TOMAHAWK WIFI" should be motherboard, not wireless_network_adapter
  // e.g. "Razer Viper Wireless" should be mouse, not wireless_network_adapter
  if (n.match(/\b(wifi|wireless|bluetooth|pci-e\s*wifi|usb\s*wifi|antenne|antenna)\b/) &&
    !n.match(/\b([abxhz]\d{3,4}[eimdpqrsv]?|trx\d{2}[a-z]?|wrx\d{2}[a-z]?|souris|mouse|clavier|keyboard|casque|headset|headphones|webcam|monitor|fan|ventilateur|case|boitier)\b/)) return 'wireless_network_adapter';
  if (n.match(/\b(ethernet|rj45|pci-e\s*lan|gigabit\s*lan|network\s*card)\b/)) return 'wired_network_adapter';

  // 4. Accessories & Other
  if (n.match(/\b(ups|onduleur|batterie\s*secours|battery\s*backup)\b/)) return 'ups';
  if (n.match(/\b(graveur|lecteur\s*dvd|blu-ray|optical\s*drive)\b/)) return 'optical_drive';
  if (n.match(/\b(externe|external\s*ssd|external\s*hdd|portable\s*drive|usb\s*3\.[012])\b/)) return 'external_storage';
  if (n.match(/\b(sound\s*card|carte\s*son|dac|amp)\b/) &&
    !n.match(/\b(rtx|gtx|radeon|geforce|rx\s*\d{3,4}|arc\s*[ab]\d{3})\b/)) return 'sound_card';
  if (n.match(/\b(riser|vertical\s*gpu|holder|bracket|mount|support|riser\s*cable|thermal\s*pad)\b/)) return 'case_accessory';
  // Fan hubs and controllers — must come before 'hub' generic accessory catch
  if (n.match(/\b(contr\u00f4leur\s*ventilateur|fan\s*controller|commander\s*pro|lighting\s*node|rgb\s*\&\s*fan\s*controller|fan\s*hub|fh-\d{2}|gh-\d{2}|edge\s*hub|uni\s*fan\s*hub|xh100\s*hub)\b/)) return 'fan_controller';
  if (n.match(/\b(c\u00e2ble|cable|adaptateur|adapter|extension|dock|frame|\u00e9cran|screen)\b/)) return 'accessory';

  // 5. Core Components (Priority check to avoid miscategorization)

  // Cooling — air coolers & AIOs (generic keywords)
  if ((n.match(/\b(aio|liquid\s*cooler|watercooler|watercooling|refroidissement\s*liquide|liquid\s*freezer|ventirad|refroidissement|aircooler|air\s*cooler|cpu\s*cooler|water\s*cooler|h60i?|h100i?|h115i?|h150i?|h170i?|h100x|h60x|kraken|ryujin|ryuo|galahad|lq\d{3}|light\s*loop|spartacus|lb\d{3}m*|proart\s*lc|mag\s*coreliquid|mpg\s*coreliquid|chione|hydroshift|hydro\s*shift|thicc\s*q\d{2}|ice-?\d{3}|ml-ultra\d{3}|symphony\s*\d{3}|waterforce\s*[x]?\s*\d{3})\b/) ||
    (n.match(/\bconnect\b/) && !n.match(/\bpsu\b/))) &&
    !n.match(/\b(case|boitier|tower|chassis|bo\u00eetier|bracket|mount|wings|bolt|airboost|panoglass|stealth|base|psu|alimentation|\d{3,4}w|flow)\b/)) return 'cooling';
  // Cooling — DeepCool AIO series: LD, LE, LM, LS, LT, LX + HYBROK HL-series (all AIOs)
  if (n.match(/\b(deepcool)\b/) &&
    n.match(/\b(ld|le|lm|ls|lt|lx)\d{3}\b/) &&
    !n.match(/\b(case|boitier|tower|chassis)\b/)) return 'cooling';
  if (n.match(/\b(hybrok)\b/) &&
    n.match(/\b(hl\d{3}|ld|le|lm)\d{0,3}\b/) &&
    !n.match(/\b(case|boitier|tower|chassis)\b/)) return 'cooling';
  // Bundles — Custom cooling kits (Hydro X, Pacific Kit, etc)
  if (n.match(/\b(hydro\s*x|pacific\s*c\d{3}|pacific\s*cl\d{3}|liquid\s*freezer\s*[ivx]+\s*pro)\b/) ||
    (n.match(/\bkit\b/) && n.match(/\b(watercooling|refroidissement\s*liquide|aio)\b/) && n.match(/\b(thermaltake|lian\s*li|corsair|arctic|cooler\s*master|msi|asus|nzxt)\b/)) ||
    (n.match(/\b(bundle|pack)\b/) && n.match(/\b(with|incl|inclus|\+)\b/) && n.match(/\b(fan|psu|gpu|cpu)\b/))) return 'bundle' as any;

  // Cooling — Corsair Titan RX series (AIO, not a case)
  if (n.match(/\b(corsair)\b/) && n.match(/\b(titan\s*\d{3}\s*rx|hydro\s*h\d{2,3}i?)\b/)) return 'cooling';
  // Cooling — model-based: AK-series, Hyper-series, Assassin, Dark Rock, Gammaxx, VELOX, etc.
  if (n.match(/\b(ak[- ]?\d{3}[a-z]*|hyper\s*\d{3}[a-z]*|hyper\s*622|assassin|dark\s*rock|shadow\s*rock|gammaxx|arctic\s*(freezer|alpine)|ag\d{3}|ets-t[456]\d|peerless\s*assassin|phantom\s*spirit|id-?cooling|corefrozr|coreliquid|castle\s*\d{3}|ml\s*(one|lcd|ultra)|ml-?(one|lcd|ultra)|a30\b|a500\b|a410\b|a620\b|mystique\s*\d{3}|masterliquid\s*[plm]*\s*\d{3}l?|masterair|th\d{3}|ux\d{3}|toughair|lc\d{3}|i70|i71c|t\d{3}\s*rgb|core\s*plus)\b/) &&
    !n.match(/\b(case|boitier|tower|chassis|bo\u00eetier|bracket|gpu|motherboard|psu|velox)\b/)) return 'cooling';

  // Cases — NZXT H-series (and Thermaltake H590 which follows the same naming)
  if (n.match(/\b(h210i?|h400i?|h440i?|h500i?|h510i?|h590\b|h700i?|h710i?|h5\s*flow|h6\s*flow|h7\s*flow|h9\s*flow|h5\s*elite|h7\s*elite|h9\s*elite|h3\s*flow|h1\s*v2)\b/)) return 'case';
  // Cases — Phanteks NV/Enthoo/Evolv series
  if (n.match(/\b(nv5|nv7|nv9|enthoo|evolv\s*[x]?)\b/)) return 'case';
  // Cases — named models from many brands
  if (n.match(/\b(o11|o11d|vision|vector|lancool|dynamic|pano|forge|gungnir|sekira|mag\s*pano|mpg\s*gungnir|mag\s*forge|mag\s*shield|m100a|120a|ap201|ap202|gt301|gt302|gt501|gt502|gr701|helios|hyperion|proart\s*pa\d*|gr701|tuf\s*gaming\s*gt|a21|a31|mc500|mc51|mc61|mca|mcmesh|mcorb|mc\d{2,3}|talos|aura\s*gc|gamdias|c8|c3|c5|c7|df800|cx300|ragn\u00e4r|nightcity|biohazard|tooq|y40|y60|y70|y70\s*touch|corsair\s*air|montech\s*air|pop\s*(air|mini|silent)|define\s*(7|c|mini|r\d)|meshify\s*(2|c)|torrent|north|ridge|terra|mood|lancool|vision|morpheus|a3\b|cte\b|cmt\d+|fv150|fv235|mc-ultra|mc-custom|mcultra|light\s*base|dark\s*base|pure\s*base|silent\s*base|qube\s*500|qube\s*540|masterframe|tomahawk\s*atx|tomahawk\s*itx|odyssey\s*x|t350m|465x|airface|blader|hadron|k20|z1|velox|panoglass|airboost|stealth|bolt)\b/) &&
    (!n.match(/\b(psu|alimentation)\b/) || n.match(/(\+|with|incl|inclus|bundle)/)) &&
    !n.match(/\b(motherboard|mb|cpu\s*cooler|ventirad|water\s*cooler|liquid|monitor|mouse|keyboard|fan|halo|wing|light\s*wings)\b/)) {
    if (n.match(/\b(\+|\-|with|incl|bundle)\b/) && n.match(/\bpsu\b/)) return 'bundle' as any;
    return 'case';
  }
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
    !n.match(/\b(fan\s+pack|argb\s+fan|rgb\s+fan|\d+\s*x\s*\d+mm|triple\s*pack|dual\s*pack|pack\s*(de\s*\d+|\d+)|fan\s*controller|hub|paste|thermal|psu|alimentation|ram|ssd|gpu|cpu|motherboard|hl\d{3}|symphony|core\s*plus|ap1-v)\b/) &&
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

  if (n.match(/\b(boitier|bo\u00eetier|case|tower|mid.?tower|full.?tower|mini.?tower|chassis|atx\s*chassis)\b/) &&
    !n.match(/\b(psu|alimentation|carte\s*m\u00e8re|motherboard|cpu\s*cooler|ventirad|fan|ventilateur|gpu|riser|monitor)\b/)) return 'case';

  // CPU / GPU / MB / RAM
  if (n.match(/\b(ryzen|core\s*i[3579]|core\s*ultra|threadripper|xeon|athlon|pentium|celeron|processeur|processor)\b/) &&
    !n.match(/\b(paste|compound|grease|pate|p\u00e2te|cooler|refroidissement|ventirad|fan|ventilateur|case|boitier|tower|frame|bracket|monitor)\b/)) return 'cpu';

  if (n.match(/\b(rtx|gtx|radeon|rx\s*\d{3,4}|arc\s*[ab]\d{3}|geforce|quadro|firepro|gt\s*\d{3}|t\d{3,4})\b/) &&
    !n.match(/\b(boitier|bo\u00eetier|case|tower|mid.?tower|chassis|riser|mount|holder|kit|monitor|ssd|nvme|m\.2|fan|cooler)\b/)) return 'gpu';

  if (n.match(/\b(carte\s*m[\u00e8e]re|motherboard|mobo|mb|zenith\s*[ivx]+)\b/) && !n.match(/\b(case|boitier|tower|psu|nvme|ssd)\b/)) return 'motherboard';
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
  if (n.match(/\b(nvme|m\.?2|ssd|hdd|disque\s*(dur|ssd)|hard\s*drive|solid\s*state|firecuda|barracuda|ironwolf|skyhawk|exos|wd\s*(blue|black|red|gold|purple)|sn\d{3,4}|bx\d{3}|mx\d{3}|su\d{3}|p[235]\s*\d{1,3}|legend\s*\d{3}|a400|v-series|sa\d{3}|s270|t70[05]|ns100|cs900|cs1030|cs2130|cs2140|dc\d{3}m?|mp\d{3}|intenso|ultrastar|mg08|mg\s*series|wd\d{2}[a-z]{4}|a55|gx2|kc\d{4}|spatium|nq100|hiksemi|fanxiang|s101|s300|s300\s*pro|n300\s*nas|surveillance\s*3\.5|990\s*pro|980\s*pro|970\s*evo|870\s*evo|qvo|cardea|zero\s*z\d{3}|sata\s*iii|2\.5\s*tray|sata\s*2\.5|vi\d{3,4}|renegade)\b/) &&
    !n.match(/\b(cpu\s*cooler|ventirad|fan|ventilateur|motherboard|carte\s*m\u00e8re|mb|socket|case|psu|monitor|ram|ddr[45]|dimm|mhz)\b/) &&
    !n.match(/\b([abxhz][1-9]10|[abxhz][1-9]70|[abxhz][1-9]90)\b/)) return 'storage';
  // Storage — high capacities (1TB+) are almost always storage for consumer parts
  if (n.match(/\b(\d+)\s*(tb|to)\b/i) && !n.match(/\b(ram|ddr[45]|mhz|cl\d{1,2}|dimm)\b/i)) return 'storage';
  // Storage — common SSD brands that often lack 'ssd' keyword
  if (n.match(/\b(sandisk|netac|kingspec|timetec|twinmos|hiksemi|fanxiang)\b/) &&
    n.match(/\b(\d+(go|gb|tb|to))\b/) &&
    !n.match(/\b(ram|memoire|m\u00e9moire|ddr\d|mhz|motherboard|case|psu)\b/)) return 'storage';
  // Storage — Toshiba NAS/surveillance/enterprise drives (explicit brand+type)
  if (n.match(/\b(toshiba)\b/) &&
    n.match(/\b(s300|n300|mg0[0-9]|p300|surveillance|enterprise|capacity|nas|\d+\s*tb|\d+\s*to)\b/)) return 'storage';
  // Storage — WD NAS/Red/Purple (not caught by generic ssd/hdd keywords)
  if (n.match(/\b(western\s*digital|wd)\b/) &&
    n.match(/\b(red|purple|gold|nas|cmr|smr|\d+\s*tb|\d+\s*to)\b/) &&
    !n.match(/\b(case|cooler|fan|psu|motherboard)\b/)) return 'storage';

  // PSU
  if ((n.match(/\b\d{2,5}\s*w\b/) || n.match(/\b(ai\d{4}t|a\d{3,4}gs?|a\d{3,4}gls?|a\d{3,4}g|80plus|80\s*plus|mwe|smart|anima|mag\s*a\d{3,4}|mpg\s*a\d{3,4}|p[567]50ss|pl\d{3}-d|px\d{3,4}-?[pg]|bn\d{3}|rm\d{3,4}[eix])\b/)) &&
    n.match(/\b(alimentation|psu|power\s*supply|gold|platinum|titanium|bronze|silver|white|ice|modular|80\s*plus|80plus|atx\s*3|semi.?mod|full.?mod|watt|\d{2,5}\s*w|ai\d{4}t|a\d{3,4}gs?|a\d{3,4}gls?|a\d{3,4}g|mwe|smart|anima|rm\d{3,4}[eix]|pl\d{3}-d|px\d{3,4}-?[pg])\b/) &&
    !n.match(/\b(case|boitier|tower|motherboard|mb|socket|cpu\s*cooler|water\s*cooler|refroidissement|[abxhz]\d{3,4}|fan|gpu)\b/)) return 'psu';
  // MSI MAG/MPG A-series PSUs: MAG A300N-H, MAG A500N-H, MAG A550BN, MPG A750GF, MPG A1000G, etc.
  if (n.match(/\b(mag|mpg)\s+a\d{3,4}[a-z]*/)) return 'psu';
  if (n.match(/\ba850gls\b/)) return 'psu';
  // Nox Hummer PSUs — "Hummer" is also a case model name but Nox Hummer + wattage = PSU
  if (n.match(/\b(nox)\b/) && n.match(/\bhummer\b/) && n.match(/\b\d{3,4}w\b/)) return 'psu';
  // Connect brand PSUs — "Connect PSU 650W", "Connect 850W 80Plus Bronze"
  if (n.match(/^connect\b/) && (n.match(/\b\d{3,4}w\b/) || n.match(/\bpsu\b/))) return 'psu';

  // Fans & Paste
  if (n.match(/\b(kryonaut|conductonaut|hydronaut|aeronaut|duronaut|carbonaut|kryosheet|polartherm|tm30|kryofuze|cryofuze|minus\s*pad|wipes|thermal\s*paste|p\u00e2te\s*thermique|pate\s*thermique|thermal\s*compound|thermal\s*grease|mx-[0-9]|mx[0-9]|liquid\s*metal|m\u00e9tal\s*liquide|m\u00e9tal\s*liquide|liquid\s*compound)\b/) &&
    !n.match(/\b(cpu|gpu|ram|ssd|nvme|psu|case|boitier|tower|fan)\b/)) return 'thermal_paste';

  if (n.match(/\b(f120|f140|ll\d{3}|ql\d{3}|fd12|fd14|fk120|sickleflow|sicklefan|tl-c12|tl-c14|af\d{3}|sp\d{3}|rs\d{3}|ar\d{3}|ml\d{3}|rs140|rs120|ar120|ar140|f360|f420|fd14|xlf120|xt120|kunai|p12|p14|fl12r|fl12\b|fl14\b|masterfan|halo|light\s*wings|silent\s*wings|pure\s*wings|shadow\s*wings|f\d{3}p|f\d{3}q|f\d{3}rgb|p\d{2}\s*max|rgb\s*core|twin\s*pack|triple\s*pack|dual\s*pack|lx\d{2,3}|flow)\b/) ||
    (n.match(/\b(ventilateur|ventilateurs)\b/) && !n.match(/\b(bo\u00eetier|boitier|case|tower|gpu|cpu|psu)\b/))) return 'fan';

  // 6. RAM
  if (n.match(/\b(dimm|ddr[2-5]|sdram|lpx|vengeance|dominator|trident|ripjaws|fury|beast|renegade|vengance|t-force|t-create|delta\s*rgb|vulcan|zeus|expert|flare\s*x|elite\s*plus|elite\s*ii|gaming\s*ram|memory\s*module|m\u00e9moire\s*ram|m\u00e9moire\s*ram)\b/) &&
    !n.match(/\b(motherboard|psu|case|boitier|tower|cpu|gpu|storage|ssd|nvme|hdd|fan|cooler|1\s*tb|2\s*tb|4\s*tb|500\s*gb|960\s*gb|1\s*to|2\s*to|4\s*to|500\s*go|960\s*go)\b/) &&
    !n.match(/\b[abxhz]\d{3,4}[eimdpqrsv]?\b/)) return 'ram';

  // 7. Secondary Cooling Models — brand + cooler model keyword
  if (n.match(/\b(noctua|deepcool|arctic|thermalright|scythe|id.?cooling|be\s*quiet|asus|msi|gigabyte|nzxt|fractal|lian\s*li|phanteks|corsair|cooler\s*master|xtrmlab)\b/) &&
    n.match(/\b(nh|ak|lc|le|se|sl|bk|dk|sk|ld|ls|lm|lf|lp|lx|pure|shadow|dark|silent|freezer|liquid|frozen|peerless|phantom|spirit|assassin|burst|notus|frost|maelstrom|ryujin|ryuo|kraken|galahad|lq\d{3}|nautilus|coreliquid|hyper\s*\d{3}|hyper\s*212|gammaxx|castle|arctic|v4\s*alpha|ml\d{3}[a-z]*|nex\s*\d{3}|helix|galax)\b/) &&
    !n.match(/\b(case|boitier|tower|chassis|bo\u00eetier|gpu|motherboard|mb|socket|psu|fan|halo|masterfan|3000d|4000d|5000d|6500d|carbide|obsidian|kryofuze|wings|base|metal)\b/)) return 'cooling';

  return null;
}
