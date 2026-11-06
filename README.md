# Ballhog Fit Wizard

Press one button and get a full Ballhog fit made from real clothing across many shops.

Live at https://yt2corgi.github.io/ballhog-fit-wizard/

## How it works

The site is fully static and runs in the visitor's browser, with no server and no keys.

- Listings come live from the public product feeds of the stores in `public/lib/stores.js`, and the chosen size gets a stock check before a piece is shown
- `public/data/saved.json` adds a small fixed list of PacSun pieces, shown as regular photos
- `public/lib/rules.js` tags each listing by slot, lane, colour and wash, and rejects slim cuts, womenswear, novelty collabs and ultra fast fashion
- `public/lib/generator.js` picks a lane and fills each slot by size match, colour harmony and shop variety, and keeps the Under $200 option within budget
- `public/lib/cut-worker.js` removes photo backgrounds in a web worker with the U2-Net small model and caches each result in the browser

Sizes and saved fits stay on the visitor's device. Share links carry the whole fit in the address.

## Run it locally

```
npm start
```

Then open http://localhost:6260/ballhog-fit-wizard/

## Tests

```
npm test
```

## Deploying

Every push to `main` runs the tests and publishes `public/` to GitHub Pages.

## History

The first commit holds an earlier version with a Node backend, eBay search and a Claude photo check. Those need private keys, so they can't run on a static site.

## Credits

Background removal uses [U-2-Net](https://github.com/xuebinqin/U-2-Net) (Apache 2.0) through [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT). Product names, photos and prices belong to their shops, and every piece links back to its listing.
