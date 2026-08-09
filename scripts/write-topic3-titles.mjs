import fs from 'fs';
import path from 'path';

const ocrDir = 'c:/Users/gayat/Downloads/bhajanamala_ocr';

function linesOf(page) {
  return fs
    .readFileSync(path.join(ocrDir, `page-${page}.txt`), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function clean(title) {
  return String(title || '')
    .replace(/^\u0c38\u0c4d\u0c30\u0c40\s*/u, '\u0c38\u0c40 ') // స్రీ -> సీ
    .replace(/^\u0c0a\u0c09\s*/u, '\u0c09\u0964 ') // ఊఉ -> ఉ॥
    .replace(/^\u0c1a\u0c02[!।]\s*/u, '\u0c1a\u0c02\u0964 ') // చం!/చం।
    .replace(/^\u0c36\u0c3e[!।]\s*/u, '\u0c36\u0c3e\u0964 ') // శా!
    .replace(/^\u0c38\u0c40\u0964\s*/u, '\u0c38\u0c40 ') // సీ॥ -> సీ
    .replace(/^\(\u0c2a\u0c4d\u0c30/u, '\u0c2a\u0c4d\u0c30') // (ప్ర -> ప్ర
    .replace(/[[\]|/]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findAfterNumber(page, songNo) {
  const lines = linesOf(page);
  const want = String(songNo);
  // OCR sometimes misreads digits (3->8, 13->18, 23->28)
  const aliases = {
    3: ['3', '8'],
    13: ['13', '18'],
    23: ['23', '28'],
  };
  const nums = aliases[songNo] || [want];
  for (let i = 0; i < lines.length; i++) {
    if (!nums.includes(lines[i])) continue;
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      const L = lines[j];
      if (/^\d{1,3}$/.test(L)) continue;
      if (L === '\u0c2d\u0c1c\u0c28\u0c2e\u0c3e\u0c32') continue;
      if (/^(\u0c36\u0c47|\u0c36\u0c40|\u0c36\u0c4d\u0c24|\u0c15\u0c4d\u0c24|\u0c30\u0c4d)/.test(L) && L.length < 8) {
        continue;
      }
      if (/^\u0c05\u0c02\u0c1c\u0c32\u0c3f/.test(L)) continue; // అంజలి
      if (L === '\u0c36\u0c4d\u0c30\u0c40\u0c38\u0c26\u0c4d\u0c17\u0c41\u0c30\u0c41 \u0c2a\u0c4d\u0c30\u0c38\u0c3e\u0c26\u0c2e\u0c41') {
        continue;
      }
      if (/^\(.*\)$/.test(L)) continue;
      if (/వద్యరత్న|పద్యరత్న|గురుపాదములాశ్రయ|పొందుపరచ|ముంజవరపు|ప్రతినిత్యము/.test(L)) {
        continue;
      }
      return clean(L);
    }
  }
  return '';
}

function findFirstPadya(page) {
  const lines = linesOf(page);
  for (const L of lines) {
    if (
      /^(చం|ఉ|ఈ|సీ|శా)/.test(L) ||
      L.includes('చం॥') ||
      L.includes('ఉ॥') ||
      L.includes('ఈ॥')
    ) {
      if (/వద్యములు|పద్యములు/.test(L)) continue;
      return clean(L);
    }
  }
  return '';
}

function pickStartsWith(page, prefix) {
  for (const L of linesOf(page)) {
    if (L.startsWith(prefix) || L.replace(/^\u0c38\u0c4d\u0c30\u0c40/, '\u0c38\u0c40').startsWith(prefix)) {
      return clean(L);
    }
  }
  return '';
}

const rows = [];
for (let n = 1; n <= 28; n++) {
  let page = 31;
  let title = '';
  if (n === 1) {
    page = 31;
    title = findFirstPadya(31);
  } else if (n === 4) {
    // OCR has no lone "4"; title follows junk "క్త"
    page = 31;
    title = pickStartsWith(31, 'ఈ॥');
  } else if (n === 5) {
    page = 31;
    title = pickStartsWith(31, 'ఉ॥ దానము');
  } else if (n === 14) {
    // section note then song; OCR digit mangled as "1శ్త"
    page = 34;
    title = pickStartsWith(34, 'సీ ఎవ్వని') || pickStartsWith(34, 'సీ');
    // prefer the ఎవ్వని line specifically
    for (const L of linesOf(34)) {
      if (L.includes('ఎవ్వని గుణజాల')) {
        title = clean(L);
        break;
      }
    }
  } else if (n <= 5) {
    page = 31;
    title = findAfterNumber(31, n);
  } else if (n <= 10) {
    page = 32;
    title = findAfterNumber(32, n);
  } else if (n <= 12) {
    page = 33;
    title = findAfterNumber(33, n);
  } else if (n <= 14) {
    page = 34;
    title = findAfterNumber(34, n);
  } else if (n <= 18) {
    page = 35;
    title = findAfterNumber(35, n);
  } else if (n <= 21) {
    page = 36;
    title = findAfterNumber(36, n);
  } else if (n <= 24) {
    page = 37;
    title = findAfterNumber(37, n);
  } else if (n <= 27) {
    page = 38;
    title = findAfterNumber(38, n);
  } else {
    page = 39;
    title = findAfterNumber(39, n);
  }
  if (!title) throw new Error('missing title for song ' + n);
  rows.push({ page, songNo: n, title });
}

fs.writeFileSync(
  new URL('./topic3-titles.json', import.meta.url),
  JSON.stringify(rows, null, 2),
  'utf8'
);
console.log('wrote', rows.length);
rows.forEach((r) => console.log(String(r.songNo).padStart(2) + '.', r.title));
