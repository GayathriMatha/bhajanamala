/** Rough Telugu → roman so English typing like "jaya" matches "జయ". */

const VOWELS = {
  '\u0C05': 'a',
  '\u0C06': 'aa',
  '\u0C07': 'i',
  '\u0C08': 'ee',
  '\u0C09': 'u',
  '\u0C0A': 'oo',
  '\u0C0B': 'ru',
  '\u0C0E': 'e',
  '\u0C0F': 'e',
  '\u0C10': 'ai',
  '\u0C12': 'o',
  '\u0C13': 'o',
  '\u0C14': 'au',
};

const MATRAS = {
  '\u0C3E': 'aa',
  '\u0C3F': 'i',
  '\u0C40': 'ee',
  '\u0C41': 'u',
  '\u0C42': 'oo',
  '\u0C43': 'ru',
  '\u0C46': 'e',
  '\u0C47': 'e',
  '\u0C48': 'ai',
  '\u0C4A': 'o',
  '\u0C4B': 'o',
  '\u0C4C': 'au',
};

const CONSONANTS = {
  '\u0C15': 'k',
  '\u0C16': 'kh',
  '\u0C17': 'g',
  '\u0C18': 'gh',
  '\u0C19': 'ng',
  '\u0C1A': 'ch',
  '\u0C1B': 'chh',
  '\u0C1C': 'j',
  '\u0C1D': 'jh',
  '\u0C1E': 'ny',
  '\u0C1F': 't',
  '\u0C20': 'th',
  '\u0C21': 'd',
  '\u0C22': 'dh',
  '\u0C23': 'n',
  '\u0C24': 't',
  '\u0C25': 'th',
  '\u0C26': 'd',
  '\u0C27': 'dh',
  '\u0C28': 'n',
  '\u0C2A': 'p',
  '\u0C2B': 'ph',
  '\u0C2C': 'b',
  '\u0C2D': 'bh',
  '\u0C2E': 'm',
  '\u0C2F': 'y',
  '\u0C30': 'r',
  '\u0C31': 'r',
  '\u0C32': 'l',
  '\u0C33': 'l',
  '\u0C35': 'v',
  '\u0C36': 'sh',
  '\u0C37': 'sh',
  '\u0C38': 's',
  '\u0C39': 'h',
};

const VIRAMA = '\u0C4D';
const ANUSVARA = '\u0C02';
const CANDRABINDU = '\u0C01';
const VISARGA = '\u0C03';

export function romanizeTelugu(input) {
  const s = String(input || '');
  let out = '';
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (VOWELS[ch]) {
      out += VOWELS[ch];
      i += 1;
      continue;
    }

    if (CONSONANTS[ch]) {
      const base = CONSONANTS[ch];
      const next = s[i + 1];
      if (next === VIRAMA) {
        out += base;
        i += 2;
        continue;
      }
      if (MATRAS[next]) {
        out += base + MATRAS[next];
        i += 2;
        continue;
      }
      out += `${base}a`;
      i += 1;
      continue;
    }

    if (ch === ANUSVARA || ch === CANDRABINDU) {
      const next = s[i + 1];
      out += CONSONANTS[next] ? 'n' : 'm';
      i += 1;
      continue;
    }
    if (ch === VISARGA) {
      out += 'h';
      i += 1;
      continue;
    }
    if (ch === VIRAMA) {
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return foldRoman(
    out
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Normalize English typing / ASR roman output. */
export function normalizeRomanQuery(q) {
  return foldRoman(
    String(q || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Fold common voice/typing variants:
 * govinda ~ gōvinda, krishna ~ krsna, jaya ~ jay, v/w, bh/b…
 */
export function foldRoman(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/aa/g, 'a')
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/chh|ch/g, 'c')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/ph/g, 'p')
    .replace(/bh/g, 'b')
    .replace(/sh|shh/g, 's')
    .replace(/w/g, 'v')
    .replace(/yya/g, 'ya')
    .replace(/(.)\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Consonant skeleton for fuzzy voice match: "govinda" → "gvnd". */
export function consonantSkeleton(s) {
  return foldRoman(s).replace(/[aeiou\s]/g, '');
}
