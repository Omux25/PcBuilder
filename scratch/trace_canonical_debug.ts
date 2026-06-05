const COLOR_TOKENS = [
    'noir', 'blanc', 'black', 'white', 'blanche', 'noire',
    'rouge', 'red', 'blue', 'bleu', 'silver', 'argent', 'gold', 'or',
    'pink', 'rose', 'green', 'vert', 'purple', 'violet', 'grey', 'gray', 'gris',
];

const NOISE_TOKENS = [
    'kit', 'bundle', 'pack', 'combo', 'oem', 'retail', 'box',
    'edition', 'version',
    'tray', 'mpk', 'wof', 'pib', 'tary', 'traw', 'boxed', 'unlocked', 'sans ventilateur', 'avec ventilateur',
    'wraith stealth', 'wraith spire', 'wraith prism', 'wraith max', 'no fan', 'processeurs', 'processeur', 'processors', 'processor',
    'sans refroidisseur', 'avec fan', 'version tray'
];

function trace(scrapedName: string, brand: string | null, category: string | null) {
    let name = scrapedName.trim();
    console.log(`[Start]: "${name}"`);

    // Only strip if the prefix does NOT contain brands or model keywords (e.g. Ryzen, Core, Radeon, GeForce, AMD, Intel, RTX, GTX)
    const hasCpuGpuKeyword = /ryzen|intel|amd|core|geforce|radeon|rtx|gtx|rx\s+\d/i.test(name.split(/[\u2013-]/)[0]);
    if (!hasCpuGpuKeyword) {
        name = name.replace(/^[^\u2013-]*[\u2013-]\s+/, '').trim();
    }
    console.log(`[After prefix]: "${name}"`);

    if (brand) {
        const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        name = name.replace(new RegExp(`^${escaped}\\s*`, 'i'), '').trim();
        console.log(`[After brand]: "${name}"`);
    }

    if (category === 'cpu') {
        name = name.replace(/\b(socket\s+)?(lga\s*\d+|am[45]|115[01]|1200|1700|1851|2011|2066)\b/gi, ' ');
        console.log(`[After socket]: "${name}"`);

        name = name.replace(/\b\d+\s*c\s*\d+\s*t\b/gi, ' ');
        name = name.replace(/\b\d+\s*c\/\d+\s*t\b/gi, ' ');
        console.log(`[After core/thread]: "${name}"`);

        name = name.replace(/\(\s*[^)]*ghz[^)]*\)/gi, ' ');
        name = name.replace(/\(\s*[^)]*ghz.*/gi, ' ');
        name = name.replace(/\b\d+(?:\.\d+)?\s*ghz\s*[\/\u2013-]\s*\d+(?:\.\d+)?\s*ghz\b/gi, ' ');
        name = name.replace(/\b\d+(?:\.\d+)?\s*ghz\b/gi, ' ');
        console.log(`[After GHz]: "${name}"`);

        name = name.replace(/\bryzen\s*([3579])\b/gi, 'Ryzen $1');
        name = name.replace(/\b(?:core\s+)?i([3579])[-\s]+(\d+\w*)\b/gi, 'Core i$1-$2');
        name = name.replace(/\bcore\s+ultra\s+(\d)[-\s]+(\d+\w*)\b/gi, 'Core Ultra $1 $2');
        name = name.replace(/\bryzen\s+(\d)[-\s]+(\d+\w*)\b/gi, 'Ryzen $1 $2');
        console.log(`[After model normalization]: "${name}"`);

        name = name.replace(/\b(\d{4,5})([xXtTkKfFsS]*)\b/g, (match, num, suffix) => {
            return num + suffix.toUpperCase();
        });
        console.log(`[After suffix casing]: "${name}"`);
    }

    const allTokens = [...COLOR_TOKENS, ...NOISE_TOKENS];
    for (const token of allTokens) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (token.includes(' ')) {
            name = name.replace(new RegExp(escaped, 'gi'), ' ');
        } else {
            name = name.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
        }
    }
    console.log(`[After tokens]: "${name}"`);

    name = name.replace(/\s+/g, ' ').trim();
    console.log(`[After whitespace]: "${name}"`);

    name = name.replace(/\(\s*\)/g, '').trim();
    name = name.replace(/^[\s\u2013.,-]+|[\s\u2013.,-]+$/g, '').trim();
    console.log(`[Final]: "${name}"`);
}

trace("AMD Ryzen 5 5600 (3.5 GHz / 4.4 GHz) Tray", "AMD", "cpu");
