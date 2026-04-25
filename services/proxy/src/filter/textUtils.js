// Shared low-level text utilities used by both judolFilter.js and typoMatcher.js.
// No public API — anything reusable across filter modules lands here.

export const LEET_CHAR_RE = /[01345678@$!|]/g;

// Single-char chains joined by punctuation: "s.l.o.t", "g*a*c*o*r".
export const OBFUSCATED_CHAIN_RE = /\b[a-z0-9](?:\s*[._\-\/\\,:;*+|~]\s*[a-z0-9]){1,}\b/gi;

// Single-char chains joined by whitespace: "w d", "s l o t".
export const SPACED_CHAIN_RE = /\b[a-z0-9](?:\s+[a-z0-9]){1,}\b/gi;

// Short multi-char chains with separator: "bo-co-ran", "po-la", "ga-cor".
export const MULTI_CHAR_CHAIN_RE = /\b[a-z0-9]{1,3}(?:\s*[._\-]\s*[a-z0-9]{1,3}){1,}\b/gi;

export function foldLeet(text, map) {
  return text.replace(LEET_CHAR_RE, (ch) => map[ch] ?? ch);
}

export function tightenIntraWord(text) {
  return text
    .replace(OBFUSCATED_CHAIN_RE, (m) => m.replace(/[\s._\-\/\\,:;*+|~]+/g, ""))
    .replace(SPACED_CHAIN_RE, (m) => m.replace(/\s+/g, ""))
    .replace(MULTI_CHAR_CHAIN_RE, (m) => m.replace(/[\s._\-]+/g, ""));
}

export function levenshtein(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
