---
name: Zip Code Info
description: Look up postal/zip code details via the Zippopotam.us API
metadata:
  attachtype: on-demand
  version: "0.1.0"
---

# Zip Code Info

Ask the user for a **country code** and **zip/postal code**, then run `scripts/get-zip-info.js`.

API: `https://api.zippopotam.us/{country}/{postal-code}`

```bash
node skills/zip-code-info/scripts/get-zip-info.js <country> <postal-code>
```
