const country = process.argv[2];
const postalCode = process.argv[3];

if (!country || !postalCode) {
  console.error("usage: get-zip-info.js <country> <postal-code>");
  process.exit(1);
}

const url = `https://api.zippopotam.us/${encodeURIComponent(country)}/${encodeURIComponent(postalCode)}`;

const response = await fetch(url);
if (!response.ok) {
  console.error(`request failed: ${response.status} ${response.statusText} (${url})`);
  process.exit(1);
}

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
