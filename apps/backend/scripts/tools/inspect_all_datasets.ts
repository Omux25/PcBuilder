const BASE = 'https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json';
const urls = {
    cpu: `${BASE}/cpu.json`,
    gpu: `${BASE}/video-card.json`,
    motherboard: `${BASE}/motherboard.json`,
    cooler: `${BASE}/cpu-cooler.json`,
    case: `${BASE}/case.json`,
    psu: `${BASE}/power-supply.json`,
    ram: `${BASE}/memory.json`,
    storage: `${BASE}/internal-hard-drive.json`,
};

for (const [name, url] of Object.entries(urls)) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log(`=== ${name.toUpperCase()} keys ===`);
        console.log(Object.keys(data[0] || {}));
    } catch(e) {
        console.error(`Failed for ${name}:`, e);
    }
}
