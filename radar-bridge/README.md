# Jack's Flight Tracker — Free Radar Bridge

This is a tiny Cloudflare Worker that lets the GitHub Pages version of Jack's Flight Tracker read live aircraft broadcasts without a paid API key. It is **not** connected to Rise & Roost.

## Cost and conditions

- Cloudflare **Workers Free** starts at $0 per month and currently includes **100,000 requests/day**, subject to terms and changes.
- Our flight feeds are [adsb.fi](https://opendata.adsb.fi/) (personal, non-commercial use; 1 request/sec limit) and [adsb.lol](https://www.adsb.lol/) (ODbL 1.0; production use should be discussed with the operator).
- This small service caches airplane results for 15 seconds. It is not suitable for aviation safety monitoring.
- The bridge is restricted by browser origin to `https://joshuamaziarz1-ux.github.io` and exposes **only** aircraft lookups and a fixed Fort Wayne search, not a general open proxy.

## Setup, no command line or credit-card payment required

1. Create or sign in to a **free** Cloudflare account at <https://dash.cloudflare.com>.
2. Open **Workers & Pages** → **Create application** → **Create Worker** (or **Start with Hello World**). Give it the name `jacks-radar` and select **Deploy**.
3. Open that Worker → **Edit Code**. Replace the starter code with the full contents of [worker.js](./worker.js), then select **Deploy**.
4. Open its `https://jacks-radar.<your-subdomain>.workers.dev/health` address in a browser. It should return `"status":"ready"`.
5. Open <https://joshuamaziarz1-ux.github.io/-jacks-flight-tracker/> → **Live radar connection (free)** → paste your full `https://...workers.dev` base URL (without `/health`) → **Connect radar**.
6. Search `N278DC` or use **Find flying plane to test**.

The browser stores the bridge URL on that device only. You can clear it in settings at any time. Other users do not get automatic access to your saved aircraft lists.

## API paths
- `/health` — Verify deployment and URL.
- `/api/aircraft/N278DC` — Live position when received.
- `/api/nearby` — Nearby public aircraft around Fort Wayne.

## What the bridge does NOT do

It does not track a person, guarantee every flight is visible, store anyone's location history, or synchronize your aircraft categories across devices. Local aircraft lists remain stored in the browser. We can add private synchronization later.
