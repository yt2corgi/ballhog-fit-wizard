export const SLOTS = ['hat', 'chain', 'top', 'belt', 'bag', 'bottoms', 'shoes'];
export const REQUIRED = ['top', 'bottoms', 'shoes'];
export const TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const LANES = {
  washed: {
    label: 'Washed denim and graphic tee',
    notes: [
      'Stack the jeans over the shoe tongue',
      'Let the tee hang loose over the belt',
      'Wear the jeans low so they break twice at the ankle',
      'Keep the tee untucked and let the wash do the work',
    ],
  },
  wax: {
    label: 'Black wax stack',
    notes: [
      'Let the coated denim pile up over the boots',
      'Keep everything black and let the top be the only loud thing',
      'Wear the belt low and let a white tee show at the hem',
      'Push the hem over the laces so the shoe barely shows',
    ],
  },
  crewneck: {
    label: 'Faded crewneck',
    notes: [
      'Push the sleeves up and let the hem sit on the belt',
      'Let the rips sit open at the knee',
      'Keep the crewneck a size big and the jeans bigger',
      'Stack the jeans over the shoe and leave the laces loose',
    ],
  },
  football: {
    label: 'Football and backpack',
    notes: [
      'Wear the backpack on both straps',
      'Tie a belt string loose at the front',
      'Let a white tee show under the hem',
      'Add wired earbuds and let the jeans sit wide over the shoes',
    ],
  },
};

const REJECT = /\b(women'?s?|woman|wmns|ladies|girls?|kids?|youth|toddler|infants?|baby|maternity|dress|skirt|bikini|bralette|leggings|gift ?card|towels?|candle|sticker|poster|mug|keychain|key ?ring|lanyard|socks?|underwear|boxers?|swim|shorts|jorts|slides?|sandals?|mules?|clogs?|sunglasses|eyewear|wallet|phone case|airpods?|skateboard|deck|incense|ashtray|tray|blanket|pillow|book|magazine|vinyl|lighter|umbrella|laces|insoles?|cleaner|protector|sample|tank|crop|cropped|bodysuit|corset|romper|compression|diaper)\b/;
const NOVELTY = /\b(minecraft|disney|star wars|pok[eé]mon|hello kitty|peanuts|barbie|persona|spongebob|marvel|realtree|sanrio|nintendo|magic: the gathering|comb and scissors|designed by)\b/;
const JNCO_LEG = /(\d{2})\s*["”]/;
const FAST_FASHION =/\b(shein|temu|romwe|zaful|cider|boohoo|prettylittlething|fashion ?nova|emmiol|dhgate|aliexpress)\b/;
const KID_SHOE = /\b(gs|ps|td|grade[- ]school|pre-?school|little kid|big kid)\b/;
const OFF_LOOK_SHOE = /\b(hiker|hiking|gtx|gore-?tex|trail|arc'?teryx|ugg|sorel|salomon|chukka|case|wedge|heel|heeled|pump|ballet|loafer)\b/;
const APPAREL = /\b(tees?|t-?shirts?|shirts?|hoodie|hooded|sweatshirt|crew|crewneck|jacket|pants?|jeans?|denim|sweater|jersey|trousers?|cardigan|vest|fleece|coat|sweatpants?|joggers?)\b/;

const DENIM = /\b(jeans?|denim)\b/;
const NOT_BOTTOM = /\b(jacket|shirt|tees?|vest|hat|cap|trucker|hoodie|overalls?|bag|backpack|belt|coverall|sweatshirt|crew|tote|pouch|bowling|duffle|barrel|pack)\b/;
const COATED_PANT = /\b(wax(ed)?|coated|lacquered|resin|leather)\b.*\b(pants?|trousers?|jeans?|denim)\b|\b(pants?|trousers?|jeans?|denim)\b.*\b(wax(ed)?|coated|lacquered|resin)\b/;
const BAGGY = /\b(baggy|wide|loose|relaxed|stack(ed)?|flared?|boot ?cut|oversized|carpenter|big|double[- ]knee|straight|ultra|skater|bull)\b/;
const NARROW = /\b(skinny|slim|tapered|super slim|tight)\b/;
const DISTRESSED = /\b(distress(ed)?|ripp?(ed)?|thrash(ed)?|destroy(ed)?|repair(ed)?|faded|vintage|bleach(ed)?|acid|paint(ed)?|splatter|grunge|mud|dirty|worn)\b/;
const LIGHT_WASH = /\b(wash(ed)?|stone|light|medium|mid|blue|indigo|sky|acid|bleach)\b/;
const RAW = /\b(raw|rigid|dark|selvedge|superdark|indigo|deep|rinse)\b/;
const COATED = /\b(wax(ed)?|coated|lacquered|resin|leather)\b/;

const CREW = /\b(crew ?neck|crew|sweatshirt)\b/;
const HOOD = /\b(hood|hoodie|hooded|zip)\b/;
const TEE = /\b(tees?|t-?shirts?|t shirt|s\/s|l\/s|long ?sleeve)\b/;
const SPORT_TOP = /\b(track ?(top|jacket)|jersey|zip[- ]?(up|hood|hoodie)|full[- ]zip|half[- ]?zip|quarter[- ]?zip|1\/4 zip|windbreaker|anorak|football|soccer|hoodie|hooded|hoody)\b/;
const NOT_TOP = /\b(sweatpants?|joggers?|pants?|hat|cap|beanie|bag|backpack|trouser|jeans?|shoes?|sneakers?|cap sleeve)\b/;
const PLAIN = /\b(blank|plain|basic|essentials?|solid|pocket|undershirt|3[- ]pack)\b/;
const GRAPHIC = /\b(graphic|logo|print(ed)?|skull|vintage|band|photo|tour|cross|reaper|flame|barbed|tiger|angel|star|wash(ed)?|distress(ed)?)\b/;
const STRIPE = /\b(stripe[ds]?|long ?sleeve|l\/s|thermal|rugby)\b/;
const FADED = /\b(faded|vintage|wash(ed)?|mineral|pigment|college|collegiate|varsity|souvenir|university|athletic|distress(ed)?|garment dyed)\b/;

const SHOE_TYPE = /\b(footwear|sneakers?|shoes?|boots?|lifestyle shoes|basketball|true retro)\b/;
const SHOE_WORD = /\b(samba|gazelle|spezial|sl ?72|superstar|campus|handball|forum|old skool|sk8|chuck|one star|half cab|dunk|jordan|aj1|air force|timberland|boots?|sneakers?|shoes?|high ?top|hi ?top|geobasket|ramones?)\b/;
const HIGH_SHOE = /\b(high|hi|high-?tops?|hi-?tops?|sk8-?hi|jordan 1|aj1|geobasket|ramones?|platform|chunky|bakin|boots?|mid)\b/;
const SPORT_SHOE = /\b(samba|gazelle|spezial|sl ?72|superstar|campus|handball|forum|country|stan smith|tokyo|bermuda)\b/;
const SKATE_SHOE = /\b(vans|old skool|sk8|authentic|chuck|converse|one star|half cab|dunk low|skate)\b/;
const BOOT = /\b(timberland|boots?|6 ?inch|combat|derby)\b/;

const HAT_TYPE = /\b(headwear|hats?|caps?|hats_wool|hats_ct)\b/;
const HAT_WORD = /\b(trucker|beanie|snapback|ballcap|fitted|5 panel|6 panel|hat|cap)\b/;
const NOT_HAT = /\b(cap sleeve|capsule|hat trick|hard cap|recap)\b/;
const BELT = /\bbelts?\b/;
const NOT_BELT = /\b(belt bag|seat|bags?|pouch)\b/;
const BACKPACK = /\b(backpacks?|rucksacks?)\b/;
const BAG = /\b(backpacks?|rucksacks?|crossbody|sling|messenger|shoulder bag|hip bag|side bag)\b/;
const NOT_BAG = /\b(bowling|duffle|duffel|lunch|barrel|laptop|sleeve|luggage|suitcase|snack|tote|toiletry|dopp|wash bag|pouch|belt bag)\b/;
const JEWELLERY = /\b(chains?|necklaces?|pendants?|bracelets?|rings?|earrings?|hoops?|studs?)\b/;
const NOT_JEWELLERY = /\b(key ?chain|wallet chain|spring|o-ring|d-ring|ring ?binder|gift|watch|iced|diamond|grillz?|moissanite|vvs|cuban)\b/;

const COLOUR_WORDS = [
  ['black', /\b(black|blk|onyx|jet|cblack|noir|ink|coal|soot)\b/],
  ['white', /\b(white|cream|bone|ecru|off[- ]white|owhite|ivory|sail|chalk|egret)\b/],
  ['grey', /\b(grey|gray|charcoal|heather|ash|silver|slate|graphite)\b/],
  ['red', /\b(red|burgundy|maroon|wine|crimson|cardinal|oxblood|bordeaux)\b/],
  ['pink', /\b(pink|magenta|fuchsia|rose)\b/],
  ['green', /\b(green|olive|forest|sage|army|moss|khaki green|camo)\b/],
  ['brown', /\b(brown|tan|khaki|wheat|chocolate|mocha|espresso|sand|beige|taupe|gum)\b/],
  ['yellow', /\b(yellow|mustard|gold)\b/],
  ['orange', /\b(orange|rust|burnt)\b/],
  ['purple', /\b(purple|violet|plum|lavender)\b/],
  ['blue', /\b(blue|navy|indigo|royal|cobalt|teal|denim|stone|wash(ed)?)\b/],
];
const NEUTRAL = new Set(['black', 'white', 'grey', 'blue', 'unknown']);

export function readColour(text) {
  for (const [name, re] of COLOUR_WORDS) if (re.test(text)) return name;
  return 'unknown';
}

export function isNeutral(colour) {
  return NEUTRAL.has(colour);
}

export function isBlocked(raw) {
  const title = `${raw.title || ''} ${raw.type || ''}`.toLowerCase();
  const vendor = (raw.vendor || '').toLowerCase();
  if (FAST_FASHION.test(`${title} ${vendor}`)) return true;
  if (REJECT.test(title) || NOVELTY.test(title)) return true;
  const tags = (raw.tags || []).map(t => String(t).toLowerCase());
  const womensOnly = tags.some(t => /^(women|womens|women's|ladies)$/.test(t)) && !tags.some(t => /^(men|mens|men's|unisex)$/.test(t));
  return womensOnly;
}

function bottomLanes(text) {
  const lanes = [];
  let score = 0;
  const distressed = DISTRESSED.test(text);
  const coated = COATED.test(text);
  const black = /\b(black|onyx|jet|noir|coal|soot)\b/.test(text);
  const raw = RAW.test(text);
  const lightish = LIGHT_WASH.test(text) && !black;
  let wash = 'mid';
  if (coated) wash = 'coated';
  else if (black) wash = 'black';
  else if (raw) wash = 'dark';
  else if (/\b(light|sky|bleach|acid)\b/.test(text)) wash = 'light';
  if ((distressed || lightish) && !black && !coated) lanes.push('washed');
  if (distressed && !black && !coated) lanes.push('crewneck');
  if (coated || black) lanes.push('wax');
  if (raw && !distressed && !coated && !black) lanes.push('football');
  if (coated) score += 3;
  if (distressed) score += 2;
  if (/\b(baggy|stack(ed)?|ultra)\b/.test(text)) score += 3;
  return { lanes, score, wash };
}

function classifyBottoms(text, vendor) {
  if (NOT_BOTTOM.test(text)) return null;
  if (!DENIM.test(text) && !COATED_PANT.test(text)) return null;
  if (NARROW.test(text)) return null;
  if (!BAGGY.test(text) && vendor !== 'jnco') return null;
  if (vendor === 'jnco' && Number(text.match(JNCO_LEG)?.[1] || 0) > 23) return null;
  const { lanes, score, wash } = bottomLanes(text);
  if (!lanes.length) return null;
  return { slot: 'bottoms', lanes, score, wash };
}

function classifyTop(text) {
  if (NOT_TOP.test(text)) return null;
  const lanes = [];
  let score = 0;
  if (CREW.test(text) && !HOOD.test(text) && !TEE.test(text)) {
    lanes.push('crewneck');
    if (FADED.test(text)) score += 3;
  }
  if (TEE.test(text) && !PLAIN.test(text)) {
    lanes.push('washed');
    if (GRAPHIC.test(text)) score += 2;
    if (DISTRESSED.test(text)) score += 2;
  }
  if ((STRIPE.test(text) || (TEE.test(text) && GRAPHIC.test(text))) && !PLAIN.test(text)) {
    lanes.push('wax');
    if (STRIPE.test(text)) score += 2;
  }
  if (SPORT_TOP.test(text)) {
    lanes.push('football');
    if (/\b(track|jersey|football|soccer)\b/.test(text)) score += 3;
  }
  if (!lanes.length) return null;
  return { slot: 'top', lanes, score };
}

function classifyShoes(text, type) {
  if (APPAREL.test(text.replace(type, ''))) return null;
  if (!SHOE_TYPE.test(type) && !SHOE_WORD.test(text)) return null;
  if (KID_SHOE.test(text) || OFF_LOOK_SHOE.test(text)) return null;
  const high = HIGH_SHOE.test(text);
  const sport = SPORT_SHOE.test(text);
  const skate = SKATE_SHOE.test(text);
  const boot = BOOT.test(text);
  const lanes = [];
  if (high || skate) lanes.push('washed');
  if (boot || high) lanes.push('wax');
  if (high || boot || skate) lanes.push('crewneck');
  if (sport || skate) lanes.push('football');
  if (!lanes.length) return null;
  let score = 0;
  if (boot || high) score += 2;
  if (sport) score += 2;
  return { slot: 'shoes', lanes, score };
}

export function classify(raw) {
  if (isBlocked(raw)) return null;
  const title = (raw.title || '').toLowerCase();
  const type = (raw.type || '').toLowerCase();
  const vendor = (raw.vendor || '').toLowerCase().trim();
  const text = `${title} ${type}`;
  const colourText = `${(raw.colourOption || '').toLowerCase()} ${title}`;
  const all = Object.keys(LANES);
  let result = null;
  if (BELT.test(title) && !NOT_BELT.test(title)) {
    result = { slot: 'belt', lanes: all, score: /\b(stud(ded)?|western|leather|spike[d]?|grommet|pyramid)\b/.test(title) ? 3 : 0 };
  } else if (BAG.test(text) && !NOT_BAG.test(text) && !APPAREL.test(title)) {
    const backpack = BACKPACK.test(text);
    result = { slot: 'bag', lanes: all, score: backpack ? 3 : 0, backpack };
  } else if (JEWELLERY.test(text) && !NOT_JEWELLERY.test(text) && !APPAREL.test(title)) {
    result = { slot: 'chain', lanes: all, score: /\b(ball chain|chain|pendant|necklace)\b/.test(title) ? 2 : 0 };
  } else if ((HAT_TYPE.test(type) || HAT_WORD.test(title)) && !NOT_HAT.test(title) && !APPAREL.test(title)) {
    result = { slot: 'hat', lanes: all, score: /\b(trucker|beanie)\b/.test(title) ? 2 : 0 };
  } else {
    result = classifyBottoms(text, vendor) || classifyTop(text) || classifyShoes(text, type);
  }
  if (!result) return null;
  const colour = readColour(colourText);
  return {
    ...result,
    colour: result.slot === 'bottoms' && colour === 'unknown' ? 'blue' : colour,
    wash: result.wash || null,
  };
}

const LETTER_TO_WAIST = { XS: 28, S: 30, M: 32, L: 34, XL: 36, XXL: 38, XXXL: 40 };
const DESIGNER_TOP = { 44: 'XS', 46: 'S', 48: 'M', 50: 'L', 52: 'XL', 54: 'XXL' };

export function readLetter(label) {
  const l = String(label)
    .toUpperCase()
    .replace(/\b(SIZE|US)\b/g, '')
    .replace(/XXX-?LARGE/g, 'XXXL')
    .replace(/XX-?LARGE/g, 'XXL')
    .replace(/X-?LARGE/g, 'XL')
    .replace(/X-?SMALL/g, 'XS')
    .replace(/\s+/g, '');
  const m = l.match(/(?:^|[^A-Z])(XXXL|3XL|XXL|2XL|XL|XS|S|M|L|SMALL|MEDIUM|LARGE)(?:$|[^A-Z])/);
  if (!m) return null;
  const v = m[1];
  if (v === '3XL') return 'XXXL';
  if (v === '2XL') return 'XXL';
  if (v === 'SMALL') return 'S';
  if (v === 'MEDIUM') return 'M';
  if (v === 'LARGE') return 'L';
  return v;
}

export function readWaist(label) {
  const nums = String(label).match(/\d{2}/g);
  if (nums) {
    const waist = Number(nums[0]);
    if (waist >= 24 && waist <= 50) {
      const inseam = nums[1] ? Number(nums[1]) : null;
      return { waist, inseam: inseam >= 26 && inseam <= 40 ? inseam : null };
    }
  }
  const letter = readLetter(label);
  if (letter) return { waist: LETTER_TO_WAIST[letter], inseam: null };
  return null;
}

export function readTop(label) {
  const letter = readLetter(label);
  if (letter) return letter;
  const num = Number(String(label).match(/\d{2}/)?.[0]);
  return DESIGNER_TOP[num] || null;
}

export function readShoe(label) {
  const s = String(label).toUpperCase();
  const us = s.match(/(?:US|M|MEN'?S?)\s*(\d{1,2}(?:\.5)?)/);
  if (us) return Number(us[1]);
  const uk = s.match(/UK\s*(\d{1,2}(?:\.5)?)/);
  if (uk) return Number(uk[1]) + 1;
  const eu = s.match(/(?:EU\s*)?(\d{2}(?:\.5)?)/);
  if (eu && Number(eu[1]) >= 38 && Number(eu[1]) <= 50) return Number(eu[1]) - 33;
  const plain = s.match(/^\s*(\d{1,2}(?:\.5)?)\s*$/);
  if (plain) return Number(plain[1]);
  return null;
}

export function displaySize(slot, label) {
  if (label == null) return null;
  const clean = String(label).replace(/^size\s*(us\s*)?/i, '').trim();
  if (/^(default title|os|one size|1 size|o\/s|adj|adjustable)$/i.test(clean)) return null;
  if (slot === 'shoes' && /^\d{2}(\.5)?$/.test(clean) && Number(clean) >= 38) return `EU ${clean}`;
  return clean;
}

export function fitVariant(slot, label, mine) {
  if (slot === 'bottoms') {
    const parsed = readWaist(label);
    if (!parsed) return -1;
    const over = parsed.waist - mine.waist;
    if (over < 0 || over > 4) return -1;
    let score = 2 - over * 0.25;
    if (parsed.inseam && parsed.inseam >= 32) score += 2;
    return score;
  }
  if (slot === 'top') {
    const letter = readTop(label);
    if (!letter) return -1;
    const over = TOP_SIZES.indexOf(letter) - TOP_SIZES.indexOf(mine.top);
    if (over < 0 || over > 2) return -1;
    return over === 1 ? 2 : over === 2 ? 1.5 : 1;
  }
  if (slot === 'shoes') {
    return readShoe(label) === Number(mine.shoe) ? 1 : -1;
  }
  return 0;
}

export function pickVariant(piece, mine) {
  const sized = ['bottoms', 'top', 'shoes'].includes(piece.slot);
  const variants = piece.variants || [];
  if (!variants.length) return piece.sizeKnown === false ? { label: null, price: piece.price, score: -0.5 } : null;
  const live = variants.filter(v => v.available !== false);
  if (!live.length) return null;
  if (!sized) {
    const v = live[0];
    return { label: piece.sizeOption && v.label !== 'Default Title' ? v.label : null, price: v.price, score: 0 };
  }
  let best = null;
  for (const v of live) {
    const score = fitVariant(piece.slot, v.label, mine);
    if (score < 0) continue;
    if (!best || score > best.score) best = { label: v.label, price: v.price, score };
  }
  return best;
}

export function harmony(piece, chosen) {
  const accents = new Set(chosen.map(p => p.colour).filter(c => !isNeutral(c)));
  let score = 0;
  if (isNeutral(piece.colour)) score += 1;
  else if (accents.has(piece.colour)) score += 3;
  else if (accents.size) score -= 4;
  if (piece.slot === 'belt' && !['black', 'brown', 'unknown'].includes(piece.colour)) score -= 4;
  if (piece.slot === 'bag' && !['black', 'grey', 'unknown', 'brown'].includes(piece.colour)) score -= 2;
  if (piece.slot === 'shoes' && chosen.some(p => p.wash === 'coated' || p.wash === 'black')) {
    if (piece.colour === 'black') score += 3;
    else if (!isNeutral(piece.colour)) score -= 3;
  }
  return score;
}

export function noteFor(lane, pick = Math.random) {
  const notes = LANES[lane].notes;
  return notes[Math.floor(pick() * notes.length)];
}
