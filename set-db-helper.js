// Expands the visible Set DB with English and Japanese Pokemon set codes.
(function () {
  if (window.__cwSetDbHelper) return;
  window.__cwSetDbHelper = true;

  const SETS = {
    BASE: 'Base-Set', JU: 'Jungle', FO: 'Fossil', B2: 'Base-Set-2', TR: 'Team-Rocket',
    G1: 'Gym-Heroes', G2: 'Gym-Challenge', N1: 'Neo-Genesis', N2: 'Neo-Discovery', N3: 'Neo-Revelation', N4: 'Neo-Destiny',
    LC: 'Legendary-Collection', EX: 'Expedition-Base-Set', AQ: 'Aquapolis', SK: 'Skyridge',
    RS: 'EX-Ruby-and-Sapphire', SS: 'EX-Sandstorm', DR: 'EX-Dragon', MA: 'EX-Team-Magma-vs-Team-Aqua', HL: 'EX-Hidden-Legends', FRLG: 'EX-FireRed-and-LeafGreen', TRR: 'EX-Team-Rocket-Returns', DX: 'EX-Deoxys', EM: 'EX-Emerald', UF: 'EX-Unseen-Forces', DS: 'EX-Delta-Species', LM: 'EX-Legend-Maker', HP: 'EX-Holon-Phantoms', CG: 'EX-Crystal-Guardians', DF: 'EX-Dragon-Frontiers', PK: 'EX-Power-Keepers',
    DP: 'Diamond-and-Pearl', MT: 'Mysterious-Treasures', SW: 'Secret-Wonders', GE: 'Great-Encounters', MD: 'Majestic-Dawn', LA: 'Legends-Awakened', SF: 'Stormfront', PL: 'Platinum', RR: 'Rising-Rivals', SV: 'Supreme-Victors', AR: 'Arceus',
    HS: 'HeartGold-and-SoulSilver', UL: 'Unleashed', UD: 'Undaunted', TM: 'Triumphant',
    BLW: 'Black-and-White', EPO: 'Emerging-Powers', NVI: 'Noble-Victories', NXD: 'Next-Destinies', DEX: 'Dark-Explorers', DRX: 'Dragons-Exalted', BCR: 'Boundaries-Crossed', PLS: 'Plasma-Storm', PLF: 'Plasma-Freeze', PLB: 'Plasma-Blast', LTR: 'Legendary-Treasures',
    XY: 'XY', FLF: 'Flashfire', FFI: 'Furious-Fists', PHF: 'Phantom-Forces', PRC: 'Primal-Clash', ROS: 'Roaring-Skies', AOR: 'Ancient-Origins', BKT: 'BREAKthrough', BKP: 'BREAKpoint', GEN: 'Generations', FCO: 'Fates-Collide', STS: 'Steam-Siege', EVO: 'Evolutions',
    SUM: 'Sun-and-Moon', GRI: 'Guardians-Rising', BUS: 'Burning-Shadows', SLG: 'Shining-Legends', CIN: 'Crimson-Invasion', UPR: 'Ultra-Prism', FLI: 'Forbidden-Light', CES: 'Celestial-Storm', DRM: 'Dragon-Majesty', LOT: 'Lost-Thunder', TEU: 'Team-Up', DET: 'Detective-Pikachu', UNB: 'Unbroken-Bonds', UNM: 'Unified-Minds', HIF: 'Hidden-Fates', CEC: 'Cosmic-Eclipse',
    SSH: 'Sword-and-Shield', RCL: 'Rebel-Clash', DAA: 'Darkness-Ablaze', CPA: 'Champions-Path', VIV: 'Vivid-Voltage', SHF: 'Shining-Fates', BST: 'Battle-Styles', CRE: 'Chilling-Reign', EVS: 'Evolving-Skies', CEL: 'Celebrations', FST: 'Fusion-Strike', BRS: 'Brilliant-Stars', ASR: 'Astral-Radiance', PGO: 'Pokemon-GO', LOR: 'Lost-Origin', SIT: 'Silver-Tempest', CRZ: 'Crown-Zenith',
    SVI: 'Scarlet-and-Violet', PAL: 'Paldea-Evolved', OBF: 'Obsidian-Flames', MEW: 'Pokemon-151', PAR: 'Paradox-Rift', PAF: 'Paldean-Fates', TEF: 'Temporal-Forces', TWM: 'Twilight-Masquerade', SFA: 'Shrouded-Fable', SCR: 'Stellar-Crown', SSP: 'Surging-Sparks', PRE: 'Prismatic-Evolutions', JTG: 'Journey-Together', DRI: 'Destined-Rivals', BLK: 'Black-Bolt', WHT: 'White-Flare',

    SV11B: 'Black-Bolt', SV11W: 'White-Flare', SV10: 'The-Glory-of-Team-Rocket', SV9A: 'Heat-Wave-Arena', SV9: 'Battle-Partners', SV8A: 'Terastal-Festival-ex', SV8: 'Super-Electric-Breaker', SV7A: 'Paradise-Dragona', SV7: 'Stellar-Miracle', SV6A: 'Night-Wanderer', SV6: 'Mask-of-Change', SV5A: 'Crimson-Haze', SV5M: 'Cyber-Judge', SV5K: 'Wild-Force', SV4A: 'Shiny-Treasure-ex', SV4M: 'Future-Flash', SV4K: 'Ancient-Roar', SV3A: 'Raging-Surf', SV3: 'Ruler-of-the-Black-Flame', SV2A: 'Pokemon-Card-151', SV2P: 'Snow-Hazard', SV2D: 'Clay-Burst', SV1A: 'Triplet-Beat', SV1S: 'Scarlet-ex', SV1V: 'Violet-ex',
    S12A: 'VSTAR-Universe', S12: 'Paradigm-Trigger', S11A: 'Incandescent-Arcana', S11: 'Lost-Abyss', S10B: 'Pokemon-GO-JP', S10A: 'Dark-Phantasma', S10P: 'Space-Juggler', S10D: 'Time-Gazer', S9A: 'Battle-Region', S9: 'Star-Birth', S8B: 'VMAX-Climax', S8A: '25th-Anniversary-Collection', S8: 'Fusion-Arts', S7R: 'Blue-Sky-Stream', S7D: 'Skyscraping-Perfection', S6A: 'Eevee-Heroes', S6K: 'Jet-Black-Spirit', S6H: 'Silver-Lance', S5A: 'Matchless-Fighters', S5R: 'Rapid-Strike-Master', S5I: 'Single-Strike-Master', S4A: 'Shiny-Star-V', S4: 'Amazing-Volt-Tackle', S3A: 'Legendary-Heartbeat', S3: 'Infinity-Zone', S2A: 'Explosive-Walker', S2: 'Rebellion-Crash', S1A: 'VMAX-Rising', S1W: 'Sword-JP', S1H: 'Shield-JP',
    SM12A: 'Tag-All-Stars', SM12: 'Alter-Genesis', SM11B: 'Dream-League', SM11A: 'Remix-Bout', SM11: 'Miracle-Twin', SM10B: 'Sky-Legend', SM10A: 'GG-End', SM10: 'Double-Blaze', SM9B: 'Full-Metal-Wall', SM9A: 'Night-Unison', SM9: 'Tag-Bolt', SM8B: 'GX-Ultra-Shiny', SM8A: 'Dark-Order', SM8: 'Super-Burst-Impact', SM7B: 'Fairy-Rise', SM7A: 'Thunderclap-Spark', SM7: 'Charisma-of-the-Wrecked-Sky', SM6B: 'Champion-Road', SM6A: 'Dragon-Storm', SM6: 'Forbidden-Light-JP', SM5M: 'Ultra-Moon', SM5S: 'Ultra-Sun', SM4A: 'GX-Battle-Boost', SM4S: 'Awakened-Heroes', SM4P: 'Ultradimensional-Beasts', SM3H: 'Darkness-that-Consumes-Light', SM3N: 'Light-Consuming-Darkness', SM2K: 'Islands-Await-You', SM2L: 'Alolan-Moonlight', SM1M: 'Collection-Moon', SM1S: 'Collection-Sun'
  };

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }
  function formatMap(map) {
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}: ${value}`).join('\n');
  }
  function install() {
    const current = read('cw_sets', {});
    const merged = { ...SETS, ...current };
    localStorage.setItem('cw_sets', JSON.stringify(merged));
    if (window.sets && typeof window.sets === 'object') Object.assign(window.sets, merged);
    const textarea = document.getElementById('setDb');
    if (textarea) textarea.value = formatMap(merged);
  }

  window.cwExpandedSets = SETS;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();
