/* French typography (v2.0 §2.3): a narrow no-break space (U+202F) before
   ; : ! ? and », and after «. Applied to every French string — locale files,
   guide content, email templates — so authors never type it by hand.
   ICU syntax ({var}, {x, plural, …}), URLs, clock times (21:00) and verse
   references (2:282) are left alone. Idempotent. Shared by Node build
   scripts and (as a copy) by the PHP I18n class. */
export const NNBSP = '\u202F';

export function frTypography(text) {
  if (typeof text !== 'string') return text;
  const keep = [];
  const protect = (re) => { text = text.replace(re, m => { keep.push(m); return `\u0000${keep.length - 1}\u0000`; }); };
  protect(/https?:\/\/[^\s»)]+/g);
  protect(/\d+:\d+(?:[–-]\d+)?/g);
  protect(/\{\s*\w+\s*,\s*(?:plural|select|selectordinal)\s*,/g);
  // Character pass: before ; ! ? » and before a ':' that ends a word, drop any
  // plain/nbsp space and insert U+202F; after « likewise. "?!" stays together.
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isColon = ch === ':' && /[\s\u0000]/.test(text[i + 1] ?? ' ');
    if (';!?»'.includes(ch) || isColon) {
      out = out.replace(/[ \u00A0\u202F]+$/, '');
      const prev = out[out.length - 1];
      const glued = (ch === '!' || ch === '?') && (prev === '?' || prev === '!');
      if (out.length && !glued && !/[\n\u0000]$/.test(out)) out += NNBSP;
      out += ch;
      continue;
    }
    if (ch === '«') { out += '«' + NNBSP; while (/[ \u00A0\u202F]/.test(text[i + 1] || '')) i++; continue; }
    out += ch;
  }
  text = out;
  return text.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
}
