// Parsar svenska prissträngar till Number (49,95 -> 49.95)
export function parsePriceSv(raw) {
  if (!raw) return null;

  let s = raw.normalize("NFKC").toLowerCase();

  s = s
    .replace(/\s*\/\s*st\b/iu, "") // "/st"
    .replace(/:-/g, "") // ":-"
    .replace(/\skr\b/iu, "") // " kr"
    .replace(/\u00a0/g, " ") // nbsp
    .replace(/[^0-9.,\-\s]/g, "") // bara siffror/tecken vi behöver
    .trim();

  if (s.includes(",")) s = s.replace(/\./g, ""); // ta bort tusenpunkter om komma finns
  s = s.replace(/\s+/g, "").replace(",", ".");

  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function parsePriceToOre(raw) {
  const n = parsePriceSv(raw);
  return n == null ? null : Math.round(n * 100); // heltal i öre
}
