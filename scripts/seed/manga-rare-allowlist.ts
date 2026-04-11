const KNOWN_MANGA_RARES = [
  ["OP01-120", "OP01"],
  ["OP02-013", "OP02"],
  ["OP03-122", "OP03"],
  ["OP04-083", "OP04"],
  ["OP05-119", "OP05"],
  ["OP06-118", "OP06"],
  ["OP07-051", "OP07"],
  ["OP08-118", "OP08"],
  ["OP09-119", "OP09"],
  ["OP10-119", "OP10"],
  ["OP11-118", "OP11"],
  ["OP12-118", "OP12"],
  ["OP13-118", "OP13"],
  ["OP14-119", "OP14"],
  ["OP15-118", "OP15"],
  ["EB01-006", "EB01"],
  ["EB02-061", "EB02"],
  ["OP01-016", "PRB01"]
] as const;

const KNOWN_MANGA_RARE_KEYS = new Set(
  KNOWN_MANGA_RARES.map(([cardId, setId]) => `${cardId}:${setId}`)
);

export function isKnownMangaRare(cardId: string, setId: string) {
  return KNOWN_MANGA_RARE_KEYS.has(`${cardId}:${setId}`);
}

export function getKnownMangaRares() {
  return [...KNOWN_MANGA_RARES];
}
