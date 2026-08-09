/**
 * Re-title every song from OCR: one pallavi/opening line only.
 * Keeps manual overrides for topics 1–3.
 */
import fs from 'fs';
import path from 'path';

const ocrDir = 'c:/Users/gayat/Downloads/bhajanamala_ocr';
const songsPath = new URL('../src/data/songs.json', import.meta.url);
const topicsPath = new URL('../src/data/topics.json', import.meta.url);
const overrideFiles = [
  './topic1-titles.json',
  './topic2-titles.json',
  './topic3-titles.json',
].map((f) => new URL(f, import.meta.url));

const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8')).topics;
const SECTION = new Set(
  topics.flatMap((t) => {
    const n = norm(t.topic);
    return [n, norm(t.topic.replace(/^\u0c36\u0c4d\u0c30\u0c40\s*/, ''))];
  })
);
SECTION.add(norm('భజనమాల'));
SECTION.add(norm('ఆణిముత్యాలు'));
SECTION.add(norm('ఆణిముత్మాలు'));
SECTION.add(norm('తత్త్వాలు'));
SECTION.add(norm('శ్రీసద్గురు ప్రసాదము'));

function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/[|॥।.,!?"'`[\](){}-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ocrLines(page) {
  const f = path.join(ocrDir, `page-${page}.txt`);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function isNoise(line) {
  const raw = String(line || '').trim();
  const t = norm(raw);
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true;
  if (/^\d{1,3}[.)]/.test(raw)) return true;
  if (/\d{1,2}-\d{1,2}-\d{2,4}/.test(t)) return true;
  if (/^(ది|తేది|తేదీ)\b/.test(t)) return true;
  if (/^\(.*\)$/.test(raw)) return true;
  if (/^రాగం/.test(t) || /^తాళం/.test(t)) return true;
  if (/రాగం\s*:/.test(t) && t.length < 60) return true;
  if (/^(ఆది|రూపకము|రూపకం|చాపు|త్రిపుట|అటతాళ)/.test(t) && t.length < 20) {
    return true;
  }
  if (
    /(వాకింగ్|ప్రసాదించిన|భోజన సమయ|ఉదయం|సాయంత్రం|మాలిష్|డాబా|తిరుపతి|వైజాగ్|హైదరాబాదు|పొందుపరచ|ముంజవరపు|ప్రతినిత్యము)/.test(
      t
    ) &&
    t.length > 16
  ) {
    return true;
  }
  if (/విరచితం|పూజ్య శ్రీ|అంజలి\s*-/.test(t) && t.length < 60) return true;
  if (/వద్యములు|పద్యములు/.test(t) && t.length < 45) return true;
  if (SECTION.has(t)) return true;
  for (const h of SECTION) {
    if (h.length >= 8 && (t === h || (t.startsWith(h) && t.length <= h.length + 10))) {
      return true;
    }
  }
  if (
    /(కీర్తనలు|పాటలు|స్తుతి|పద్యరత్న|వద్యరత్న|శ్లోకాలు|ముత్యాలు|ముత్మాలు)/.test(t) &&
    t.length < 55
  ) {
    return true;
  }
  const crumb = raw.replace(/[\u200c\u200d]/g, '');
  if (
    t.length <= 8 &&
    !/\s/.test(raw) &&
    /^(శ్త|శే|శీ|శో|శై|శ్ర|లై|తి|ర్|గే|గ|క్ష|క్త|డీ|డ్త|రి|భ్|మ్య)/.test(crumb)
  ) {
    return true;
  }
  if (!/[\u0C00-\u0C7F]/.test(raw) && t.length < 24) return true;
  return false;
}

function tidy(line) {
  let s = String(line || '')
    .replace(/^!\s*/u, '')
    .replace(/^-\s*/u, '')
    .replace(/^[''"]?ప॥\s*/u, '')
    .replace(/^స్రీ\s*/u, 'సీ ')
    .replace(/^ఊఉ\s*/u, 'ఉ॥ ')
    .replace(/^(శో|శీ|శే|శై|శ్రే|లై|శ్లో|సీ|క్షే)\s*[।|॥.]?\s*/u, (m, g) =>
      g === 'సీ' || g === 'శ్లో' ? `${g} ` : ''
    )
    .replace(/^॥?శ్టో।\s*/u, '')
    .replace(/^॥?శ్లో॥?\s*/u, '')
    .replace(/^(చం|శా|ఉ)[!।]\s*/u, '$1॥ ')
    .replace(/^సీ॥\s*/u, 'సీ ')
    .replace(/^\(\s*/u, '')
    .replace(/^[|[\]]+\s*/u, '')
    .replace(/^\d{1,3}[.)]\s*/u, '')
    .replace(/[[\]|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Keep a single display line: cut soft at first danda if long
  if (s.length > 72) {
    const cut = s.search(/॥/);
    if (cut > 12 && cut <= 72) s = s.slice(0, cut).trim();
    else s = s.slice(0, 72).replace(/\s+\S*$/, '').trim();
  }
  return s;
}

function firstWords(t, n) {
  return tidy(t).split(/\s+/).filter(Boolean).slice(0, n).join(' ');
}

function numberedStarts(lines, page) {
  const out = [];
  for (let j = 0; j < lines.length; j++) {
    if (!/^\d{1,3}$/.test(lines[j])) continue;
    const n = Number(lines[j]);
    if (n === page && j >= lines.length - 3) continue;
    let k = j + 1;
    while (k < lines.length && isNoise(lines[k])) k++;
    if (k < lines.length) out.push({ n, k, at: j });
  }
  return out;
}

function pallaviGaps(lines, firstSongNo) {
  let scan = 0;
  while (scan < lines.length && (lines[scan] === 'భజనమాల' || isNoise(lines[scan]))) {
    scan++;
  }
  if (firstSongNo > 1) {
    while (scan < lines.length) {
      const L = lines[scan];
      if (isNoise(L) || L.length <= 3) {
        scan++;
        continue;
      }
      if (/సద్గురు\s*\(?\s*ప్రభో|॥స॥|॥వెం॥|॥మమ॥|॥హం॥/.test(L)) {
        scan++;
        continue;
      }
      if (/^\S+\s*-\s*సద్గురు/.test(L)) {
        scan++;
        continue;
      }
      break;
    }
  }
  const cands = [];
  for (let j = scan; j < lines.length; j++) {
    const L = lines[j];
    const prev = lines[j - 1] || '';
    if (isNoise(L)) continue;
    if (/^\d{1,3}[.)]/.test(L)) continue;
    if (L.length < 6) continue;
    const prevGap =
      j === scan ||
      isNoise(prev) ||
      (prev.replace(/[\u200c\u200d]/g, '').trim().length <= 2) ||
      (/^(శ్త|శే|శీ|తి|ర్|గే|క్ష|క్త|డీ|డ్త|రి)/.test(prev.replace(/[\u200c\u200d]/g, '').trim()) &&
        prev.length <= 8);
    // do not treat charanam "2. …" as gap for NEXT line as new song via isNoise(prev)
    if (/^\d{1,3}[.)]/.test(prev.trim())) continue;
    if (!(j === scan || prevGap)) continue;
    cands.push(j);
  }
  return cands;
}

function titleAt(lines, startIdx) {
  if (startIdx < 0) return '';
  for (let j = startIdx; j < Math.min(lines.length, startIdx + 14); j++) {
    if (isNoise(lines[j])) continue;
    const t = tidy(lines[j]);
    if (!t || t.length < 4) continue;
    if (isNoise(t)) continue;
    return t;
  }
  return '';
}

const data = JSON.parse(fs.readFileSync(songsPath, 'utf8'));
const songs = data.songs;

const byPage = new Map();
for (const s of songs) {
  if (!byPage.has(s.page)) byPage.set(s.page, []);
  byPage.get(s.page).push(s);
}

let improved = 0;
let placeholders = 0;

for (const [page, pageSongs] of byPage) {
  pageSongs.sort((a, b) => a.songNo - b.songNo || a.id - b.id);
  const lines = ocrLines(page);
  const numbered = numberedStarts(lines, page);
  const usedNum = new Set();
  const starts = [];

  for (let m = 0; m < pageSongs.length; m++) {
    const want = pageSongs[m].songNo;
    let pick = numbered.findIndex((b, idx) => !usedNum.has(idx) && b.n === want);
    if (pick < 0 && m === 0 && want === 1) {
      let i = 0;
      while (i < lines.length && (lines[i] === 'భజనమాల' || isNoise(lines[i]))) i++;
      starts.push(i < lines.length ? i : -1);
      continue;
    }
    if (pick >= 0) {
      usedNum.add(pick);
      starts.push(numbered[pick].k);
    } else {
      starts.push(-1);
    }
  }

  // orphan OCR digits → unmatched markers
  const orphans = numbered.filter((_b, idx) => !usedNum.has(idx)).map((b) => b.k);
  let oi = 0;
  for (let m = 0; m < starts.length; m++) {
    if (starts[m] >= 0) continue;
    if (oi < orphans.length) starts[m] = orphans[oi++];
  }

  const fallback = pallaviGaps(lines, pageSongs[0]?.songNo || 1);
  const claimed = new Set(starts.filter((s) => s >= 0));
  const unusedFb = fallback.filter((j) => {
    if (claimed.has(j)) return false;
    for (const s of claimed) if (Math.abs(s - j) <= 1) return false;
    return true;
  });
  let fb = 0;
  for (let m = 0; m < starts.length; m++) {
    if (starts[m] >= 0) continue;
    if (fb < unusedFb.length) starts[m] = unusedFb[fb++];
  }

  for (let m = 0; m < pageSongs.length; m++) {
    const s = pageSongs[m];
    let title = titleAt(lines, starts[m]);
    if (!title) {
      title = `\u0c2a\u0c3e\u0c1f ${s.songNo}`;
      placeholders++;
    } else {
      improved++;
    }
    s.title = title;
    s.opening = title;
    s.phrase3 = firstWords(title, 3);
    s.phrase4 = firstWords(title, 4);
  }
}

// Manual overrides win
for (const file of overrideFiles) {
  if (!fs.existsSync(file)) continue;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const row of rows) {
    const s = songs.find((x) => x.page === row.page && x.songNo === row.songNo);
    if (!s) continue;
    const title = tidy(row.title);
    s.title = title;
    s.opening = title;
    s.phrase3 = firstWords(title, 3);
    s.phrase4 = firstWords(title, 4);
  }
}

// Final pass: force one-line tidy on everything
for (const s of songs) {
  s.title = tidy(s.title);
  s.opening = s.title;
  s.phrase3 = firstWords(s.title, 3);
  s.phrase4 = firstWords(s.title, 4);
}

data.method = (data.method || '') + ' + one-line-ocr-titles';
fs.writeFileSync(songsPath, JSON.stringify(data, null, 2), 'utf8');

const counts = new Map();
for (const s of songs) counts.set(s.topicPage, (counts.get(s.topicPage) || 0) + 1);
const ph = songs.filter((s) => /^పాట\s*\d+$/.test(s.title)).length;

console.log('songs', songs.length, 'retitled', improved, 'placeholders', ph);
topics.forEach((t, i) => {
  const list = songs.filter((s) => s.topicPage === t.page);
  console.log(
    '\n' +
      String(i + 1).padStart(2) +
      '. ' +
      t.topic +
      ' (' +
      list.length +
      ')'
  );
  list.slice(0, 5).forEach((s, j) => {
    console.log('   ' + (j + 1) + '. ' + s.title);
  });
  if (list.length > 5) console.log('   …');
});
