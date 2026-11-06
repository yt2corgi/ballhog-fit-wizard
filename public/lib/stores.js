export const STORES = [
  { host: 'mnml.la', name: 'MNML', slots: ['bottoms', 'top', 'belt'], pages: 8 },
  { host: 'jnco.com', name: 'JNCO', slots: ['bottoms', 'top'], pages: 4 },
  { host: 'warrenlotas.com', name: 'Warren Lotas', slots: ['top', 'bottoms'], pages: 4 },
  { host: 'afflictionclothing.com', name: 'Affliction', slots: ['top', 'bottoms', 'belt', 'hat'], pages: 8 },
  { host: 'amiri.com', name: 'AMIRI', slots: ['bottoms', 'shoes', 'top', 'belt'], pages: 6 },
  { host: 'shop-us.doverstreetmarket.com', name: 'Dover Street Market', slots: ['bottoms', 'top', 'shoes', 'bag', 'belt'], pages: 12 },
  { host: 'edhardyoriginals.com', name: 'Ed Hardy', slots: ['top'], pages: 3 },
  { host: 'oneofthesedays.com', name: 'One of These Days', slots: ['top', 'hat'], pages: 3 },
  { host: 'wearebraindead.com', name: 'Brain Dead', slots: ['top', 'hat', 'bottoms'], pages: 6 },
  { host: 'ecko.com', name: 'Ecko', slots: ['top', 'bottoms'], pages: 2 },
  { host: 'stussy.com', name: 'Stussy', slots: ['top', 'hat', 'bottoms'], pages: 5 },
  { host: 'karlkani.com', name: 'Karl Kani', slots: ['bottoms', 'top'], pages: 1 },
  { host: 'crosscolours.com', name: 'Cross Colours', slots: ['bottoms', 'top', 'hat'], pages: 1 },
  { host: 'hellstar.com', name: 'Hellstar', slots: ['top'], pages: 4 },
  { host: 'trippnyc.com', name: 'Tripp NYC', slots: ['belt', 'bottoms', 'top'], pages: 4 },
  { host: 'aimeleondore.com', name: 'Aime Leon Dore', slots: ['top', 'hat'], pages: 4 },
  { host: 'undefeated.com', name: 'Undefeated', slots: ['shoes', 'top'], pages: 6 },
  { host: 'feature.com', name: 'Feature', slots: ['shoes', 'top'], pages: 6 },
  { host: 'blendsus.com', name: 'Blends', slots: ['shoes'], pages: 8 },
  { host: 'socialstatuspgh.com', name: 'Social Status', slots: ['shoes', 'top'], pages: 6 },
  { host: 'extrabutterny.com', name: 'Extra Butter', slots: ['shoes'], pages: 6 },
  { host: 'dtlr.com', name: 'DTLR', slots: ['shoes', 'hat'], pages: 6 },
  { host: 'vondutch.com', name: 'Von Dutch', slots: ['hat', 'bag'], pages: 4, weight: 2 },
  { host: 'topodesigns.com', name: 'Topo Designs', slots: ['bag', 'hat'], pages: 3, weight: -2 },
  { host: 'herschel.com', name: 'Herschel', slots: ['bag'], pages: 2 },
  { host: 'vitalydesign.com', name: 'Vitaly', slots: ['chain'], pages: 2, weight: 2 },
  { host: 'kingice.com', name: 'King Ice', slots: ['chain'], pages: 3, weight: -4 },
];

export const IMAGE_HOSTS = [
  'cdn.shopify.com',
  'images.asos-media.com',
  'www.pacsun.com',
  'i.ebayimg.com',
  ...STORES.map(s => s.host),
  ...STORES.map(s => `www.${s.host}`),
];

const LINK_HOSTS = ['www.asos.com', 'www.pacsun.com', 'www.ebay.com', ...STORES.map(s => s.host), ...STORES.map(s => `www.${s.host}`)];

export function isAllowedLink(href) {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' && LINK_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

export function isAllowedImage(src) {
  try {
    const u = new URL(src);
    return u.protocol === 'https:' && IMAGE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}
