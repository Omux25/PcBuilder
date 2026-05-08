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

    // Penalize MPK/Bundle images — prefer clean product shots when alternatives exist
    // But don't make score negative — if this is the only image, it's better than nothing
    if (urlLower.includes('mpk') || urlLower.includes('bundle')) {
        score -= 30; // Prefer non-MPK but still usable
    }

    if (urlLower.includes('placeholder') || urlLower.includes('no-image') || urlLower.includes('default')) {
        score -= 100; // Hard reject placeholders
    }

    if (urlLower.includes('thumb') || urlLower.includes('small') || urlLower.includes('icon')) {
        score -= 20; // Prefer full-size images
    }

    // Bonuses
    if (urlLower.includes('large') || urlLower.includes('full') || urlLower.includes('original')) {
        score += 20; // Prefer high-res
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
