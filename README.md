# Ballhog Fit Wizard

Press one button and get a full Ballhog fit made from real clothing across many shops.

## Run it

```
npm install
npm run setup
npm start
```

Then open http://localhost:6260. `npm run setup` downloads the free background removal model once.

## Optional keys

Copy `.env.example` to `.env` and restart. The site works without any keys.

| Key | What it switches on |
| --- | --- |
| `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` | Live eBay resale search. Free at developer.ebay.com |
| `ANTHROPIC_API_KEY` | Claude checks each listing photo and saves the verdict so a listing is only paid for once |
| `CLAUDE_MODEL` | Defaults to `claude-opus-5-5`. `claude-haiku-5-5` is much cheaper |
| `CLAUDE_DAILY_CAP_USD` | Daily spend limit. Defaults to 2. Past it the site uses keywords only |

## Where pieces come from

- Live on every click: the Shopify stores in `server/stores.js`, plus eBay once keyed. Final picks get a live stock check for the chosen size
- Saved list: `data/saved.json`, currently ASOS and PacSun. `npm run seed` rebuilds it. Dead links are checked once a day and dropped

To add a hand-picked piece from a shop that blocks automated requests, add an entry to `data/saved.json`:

```json
{
  "shop": "Grailed",
  "brand": "True Religion",
  "title": "Baggy distressed jeans",
  "price": 120,
  "url": "https://www.grailed.com/listings/...",
  "image": "https://...",
  "condition": "Pre-owned"
}
```

The image host also has to be listed in `IMAGE_HOSTS` in `server/stores.js`.

## How a fit gets built

1. `server/rules.js` tags every listing by slot, lane, colour and wash from its text, and rejects slim cuts, womenswear, novelty collabs and ultra fast fashion
2. `server/generator.js` picks a lane, then fills each slot by scoring size match, colour harmony and shop variety
3. `server/cutout.js` removes photo backgrounds once per image and caches them in `cache/cut`

## Tests

```
npm test
```
