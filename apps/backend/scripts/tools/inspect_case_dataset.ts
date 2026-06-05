const res = await fetch('https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json/case.json');
const data = await res.json();
console.log(JSON.stringify(data.slice(0, 3), null, 2));
