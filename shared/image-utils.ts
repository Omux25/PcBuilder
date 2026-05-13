/**
 * Image quality utilities for choosing the best product image
 */

/**
 * Score an image URL for quality (higher is better)
 *
 * Penalties:
 * - MPK/Bundle images: -100 (avoid package/bundle images)
 * - Generic/placeholder: -50
 * - Low resolution indicators: -20
 *
 * Bonuses:
 * - High resolution indicators: +20
 * - Clean product shots: +10
 */
export function scoreImageQuality(imageUrl: string, productName: string): number {
    if (!imageUrl) return -1000;

    let score = 50; // Base score

    const urlLower = imageUrl.toLowerCase();
    const nameLower = productName.toLowerCase();

    // Hard reject: PC build / bundle images from SetupGame and PC Gamer Casa.
    // These retailers name their images after complete PC builds, not individual components.
    // e.g. "700R-–-AMD-RYZEN-9-9950X3D-RTX-PRO-6000-Blackwell-96Go.webp"
    //      "Pc-Gamer-R5-5500GT-SG-BLADER-Setup-Game-Maroc.jpg"
    //      "COMET-R5-PRO-5655G-VEGA-7-Setup-Game.webp"
    const filename = urlLower.split('/').pop() ?? '';
    if (
        filename.includes('pc-gamer') ||
        filename.includes('pc_gamer') ||
        filename.includes('setup-game') ||
        filename.includes('setup_game') ||
        // Filename contains both a CPU and GPU model — it's a build photo
        (/ryzen|core.i[3579]|core.ultra/.test(filename) && /rtx|gtx|radeon|rx.?\d{4}/.test(filename))
    ) {
        return -500; // Hard reject — never use build photos as component images
    }

    // Penalize MPK/Bundle images — prefer clean product shots when alternatives exist
    // But don't make score negative — if this is the only image, it's better than nothing
    if (urlLower.includes('mpk') || urlLower.includes('bundle')) {
        score -= 30; // Prefer non-MPK but still usable
    }

    // Hard reject placeholders, but allow PrestaShop standard sizes like 'large_default'
    if ((urlLower.includes('placeholder') || urlLower.includes('no-image')) || 
        (urlLower.includes('default') && !urlLower.includes('large_default') && !urlLower.includes('home_default'))) {
        score -= 100;
    }

    if (urlLower.includes('thumb') || urlLower.includes('small') || urlLower.includes('icon')) {
        score -= 20; // Prefer full-size images
    }

    // Penalties
    if (urlLower.includes('tray') || urlLower.includes('mpk') || urlLower.includes('no-fan')) {
        score -= 20; // Prefer retail boxes over tray chips
    }

    // Bonuses
    if (urlLower.includes('large') || urlLower.includes('full') || urlLower.includes('original')) {
        score += 20; // Prefer high-res
    }

    // BIG BONUS for Box/Retail packaging shots (User preference)
    if (urlLower.includes('box') || urlLower.includes('retail') || urlLower.includes('packaging')) {
        score += 50; 
    }

    // PENALTY for NextLevel generic CPU placeholders (User preference)
    // Detected by presence of 'tray', 'mpk', or 'no-fan' OR if it's a CPU image from NextLevel without 'box'
    if (urlLower.includes('nextlevelpc') && (nameLower.includes('ryzen') || nameLower.includes('intel') || nameLower.includes('core'))) {
        const isBox = urlLower.includes('box') || urlLower.includes('retail') || urlLower.includes('packaging');
        const isGeneric = urlLower.includes('tray') || urlLower.includes('mpk') || urlLower.includes('no-fan') || urlLower.includes('wraith-stealth');
        
        if (isGeneric && !isBox) {
            score -= 60; // Very high penalty to ensure it's last resort
        } else if (!isBox) {
            score -= 30; // Medium penalty for any NextLevel CPU image that isn't explicitly a box
        }
    }

    // Prefer images that match the product name (not generic)
    const nameWords = nameLower.split(/\s+/).filter(w => w.length > 3);
    const urlWords = urlLower.split(/[\/\-_.]/).filter(w => w.length > 3);
    const matchingWords = nameWords.filter(w => urlWords.some(uw => uw.includes(w) || w.includes(uw)));

    if (matchingWords.length >= 2) {
        score += 10; // Image URL matches product name
    }

    return score;
}

/**
 * Choose the best image from multiple options
 */
export function chooseBestImage(images: Array<{ url: string; productName: string }>): string | null {
    if (images.length === 0) return null;
    if (images.length === 1) return images[0].url;

    const scored = images.map(img => ({
        url: img.url,
        score: scoreImageQuality(img.url, img.productName)
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return the best image (highest score)
    return scored[0].url;
}
