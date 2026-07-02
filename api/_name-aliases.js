function normalizeSpaces(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function foldName(value) {
  return normalizeSpaces(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GERMAN_TRAINER_ALIASES = {
  schweisser: ['Welder'],
  'forschung des professors': ["Professor's Research"],
  'befehl vom boss': ["Boss's Orders"],
  'bosss befehle': ["Boss's Orders"],
  mary: ['Marnie'],
  cynthia: ['Cynthia'],
  n: ['N'],
  richter: ['Judge'],
  'professor eichs hinweis': ["Professor Oak's Hint"],
  'professor eich': ['Professor Oak'],
  'top genesung': ['Full Heal'],
  beleber: ['Revive'],
  sonderbonbon: ['Rare Candy'],
  hyperball: ['Ultra Ball'],
  superball: ['Great Ball'],
  pokeball: ['Poke Ball'],
  'poke ball': ['Poke Ball'],
  nestball: ['Nest Ball'],
  flottball: ['Quick Ball'],
  finsterball: ['Dusk Ball'],
  timerball: ['Timer Ball'],
  levelball: ['Level Ball'],
  freundesball: ['Friend Ball'],
  tausch: ['Switch'],
  fluchtseil: ['Escape Rope'],
  energiewechsel: ['Energy Switch'],
  energiesuche: ['Energy Search'],
  'energie suche': ['Energy Search'],
  'doppelte farblose energie': ['Double Colorless Energy'],
  'doppelte turbo energie': ['Double Turbo Energy'],
  'feuer energie': ['Fire Energy'],
  'wasser energie': ['Water Energy'],
  'pflanzen energie': ['Grass Energy'],
  'elektro energie': ['Lightning Energy'],
  'kampf energie': ['Fighting Energy'],
  'psycho energie': ['Psychic Energy'],
  'finsternis energie': ['Darkness Energy'],
  'metall energie': ['Metal Energy'],
  'feen energie': ['Fairy Energy'],
  'drachen energie': ['Dragon Energy'],
  'kampf vip pass': ['Battle VIP Pass'],
  waldsiegelstein: ['Forest Seal Stone'],
  erdversiegelungsstein: ['Earthen Seal Stone'],
  luftballon: ['Air Balloon'],
  wahlband: ['Choice Band'],
  wahlschal: ['Choice Scarf'],
  riesenumhang: ['Giant Cape'],
  stadionruine: ['Ruins of Alph'],
  'pfad zum gipfel': ['Path to the Peak'],
  'stadt ohne namen': ['Lost City']
};

function addUnique(target, value) {
  const clean = normalizeSpaces(value);
  if (clean && !target.some((item) => foldName(item) === foldName(clean))) target.push(clean);
}

function addExMegaVariants(target, value) {
  const clean = normalizeSpaces(value)
    .replace(/\bex\b/ig, 'EX')
    .replace(/\bgx\b/ig, 'GX')
    .replace(/\bvmax\b/ig, 'VMAX')
    .replace(/\bvstar\b/ig, 'VSTAR');
  addUnique(target, clean);

  const mega = clean.match(/^M\s+(.+?)\s*[- ]\s*EX$/i) || clean.match(/^Mega\s+(.+?)\s*[- ]\s*EX$/i);
  if (mega) {
    const base = normalizeSpaces(mega[1]);
    addUnique(target, `M ${base}-EX`);
    addUnique(target, `M ${base} EX`);
    addUnique(target, `Mega ${base}-EX`);
    addUnique(target, `Mega ${base} EX`);
    addUnique(target, `${base}-EX`);
    addUnique(target, `${base} EX`);
  }

  const ex = clean.match(/^(.+?)\s*[- ]\s*EX$/i);
  if (ex) {
    const base = normalizeSpaces(ex[1]);
    addUnique(target, `${base}-EX`);
    addUnique(target, `${base} EX`);
  }

  const gx = clean.match(/^(.+?)\s*[- ]\s*GX$/i);
  if (gx) {
    const base = normalizeSpaces(gx[1]);
    addUnique(target, `${base}-GX`);
    addUnique(target, `${base} GX`);
  }
}

export function nameSearchVariants(value) {
  const variants = [];
  const raw = normalizeSpaces(value);
  if (!raw) return variants;

  addExMegaVariants(variants, raw);
  addExMegaVariants(variants, raw.replace(/-/g, ' '));

  const folded = foldName(raw);
  for (const alias of GERMAN_TRAINER_ALIASES[folded] || []) addExMegaVariants(variants, alias);

  return variants.slice(0, 12);
}
