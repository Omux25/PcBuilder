const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'fr-MA,fr;q=0.8,en-US;q=0.5,en;q=0.3',
  'Accept-Encoding': 'gzip, deflate, br',
  'X-Requested-With': 'XMLHttpRequest',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'Connection': 'keep-alive',
};

async function test() {
  const CATEGORY_PATHS = [
    '165-processeur',
    '144-carte-graphique-video-gpu',
    '169-carte-mere',
    '181-memoire-ram',
    '250-disques-durs',
    '179-alimentation-pc-psu',
    '253-boitier-gamer',
    '269-cpu-cooler',
  ];

  console.log("Testing AJAX in parallel (staggered)...");
  const results = await Promise.allSettled(
    CATEGORY_PATHS.map(async (path, index) => {
      if (index > 0) await new Promise(r => setTimeout(r, index * 1000));
      const url = `https://nextlevelpc.ma/${path}?ajax=1&action=updateProductList&resultsPerPage=1000`;
      const res = await fetch(url, { headers: { ...HEADERS, 'Referer': `https://nextlevelpc.ma/${path}` } });
      console.log(`[${path}] Status: ${res.status}`);
      return res.status;
    })
  );
}

test();

test();
