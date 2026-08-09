import fs from 'fs';
import path from 'path';

const textDir = 'c:/Users/gayat/Downloads/bhajanamala_ocr';
const songsOut = 'C:/Users/gayat/source/repos/bhajanamala/src/data/songs.json';

function cleanLine(s) {
  return s
    .replace(/[|॥।.,!?"'`[\](){}]+/g, ' ')
    .replace(/[\u200c\u200d]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstWords(line, n = 4) {
  return cleanLine(line)
    .split(' ')
    .filter(Boolean)
    .slice(0, n)
    .join(' ');
}

function isDateOrNote(line) {
  const t = cleanLine(line);
  if (!t) return true;
  if (t === 'భజనమాల') return true;
  if (/^\d+$/.test(t)) return true;
  // dates like 3-10-80, 15-6-1980, ది 3-10-80
  if (/\d{1,2}-\d{1,2}-\d{2,4}/.test(t)) return true;
  if (/^(ది|తేది|తేదీ)\s*\d{1,2}-\d{1,2}-\d{2,4}/.test(t)) return true;
  if (/^(ది|తేది|తేదీ)\b/i.test(t)) return true;
  if (/^\(.*\)$/.test(t) && t.length > 40) return true; // long parenthetical notes
  if (/ప్రసాదించిన|వాకింగ్|ఉదయం శ్రీ|సాయంత్రం/.test(t) && t.length > 25) return true;
  return false;
}

function isJunkTitle(line) {
  if (isDateOrNote(line)) return true;
  if (line.length < 6) return true;
  if (!/[\u0C00-\u0C7F]/.test(line)) return true;
  if (/^(సీ|శా|ఉ|చం|శ్రే|శో|క|గే|శ్లో|శే)\.?$/i.test(cleanLine(line))) return true;
  return false;
}

const files = fs
  .readdirSync(textDir)
  .filter((f) => /^page-\d+\.txt$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

const songs = [];
const seen = new Set();

for (const file of files) {
  const page = parseInt(file.match(/\d+/)[0], 10);
  const text = fs.readFileSync(path.join(textDir, file), 'utf8');
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = (lines[i - 1] || '').trim();

    // Song starts after a lone big number, or clear pallavi-like line after blank/header
    const afterSongNo = /^\d{1,3}$/.test(prev);
    const numbered = /^(\d{1,3})[.)]\s+(.+)$/.exec(line);
    // Only treat numbered lines as NEW songs when number is small AND previous was blank/header
    // Avoid charanam spam: require afterSongNo OR (numbered with num<=3 and not date)

    let openingLine = null;
    if (afterSongNo && !isJunkTitle(line)) {
      openingLine = line;
    } else if (numbered) {
      const rest = numbered[2].trim();
      const n = Number(numbered[1]);
      // only 1. as potential new song start if not a date; skip 2. 3. charanams unless after song no
      if (n === 1 && !isJunkTitle(rest) && (prev === '' || prev === 'భజనమాల' || afterSongNo)) {
        openingLine = rest;
      }
    }

    if (!openingLine || isJunkTitle(openingLine)) continue;

    // skip forward past date notes to real lyric line if needed
    let titleLine = openingLine;
    let startIdx = i;
    if (isDateOrNote(titleLine)) continue;

    const phrase4 = firstWords(titleLine, 4);
    const phrase3 = firstWords(titleLine, 3);
    if (!phrase4 || phrase4.length < 6) continue;
    if (seen.has(phrase4)) continue;
    seen.add(phrase4);

    // lyrics from OCR for search only — display will use PDF page
    const lyricLines = [];
    for (let j = startIdx; j < lines.length && lyricLines.length < 50; j++) {
      const L = lines[j];
      if (j > startIdx && /^\d{1,3}$/.test(L)) break;
      if (L === 'భజనమాల') continue;
      if (/^\d+$/.test(L) && Number(L) === page) continue;
      if (isDateOrNote(L) && j !== startIdx) continue;
      lyricLines.push(L);
    }

    songs.push({
      id: songs.length + 1,
      phrase3,
      phrase4,
      opening: firstWords(titleLine, 12),
      page,
      lyrics: lyricLines.join('\n').trim(),
      source: 'pdf',
    });
  }
}

// Ensure every page is searchable even if header detection missed — use first real lyric line
for (const file of files) {
  const page = parseInt(file.match(/\d+/)[0], 10);
  const has = songs.some((s) => s.page === page);
  if (has) continue;
  const text = fs.readFileSync(path.join(textDir, file), 'utf8');
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isJunkTitle(l));
  if (!lines.length) continue;
  const titleLine = lines[0];
  const phrase4 = firstWords(titleLine, 4);
  if (!phrase4 || seen.has(phrase4)) continue;
  seen.add(phrase4);
  songs.push({
    id: songs.length + 1,
    phrase3: firstWords(titleLine, 3),
    phrase4,
    opening: firstWords(titleLine, 12),
    page,
    lyrics: lines.slice(0, 40).join('\n'),
    source: 'pdf-page',
  });
}

songs.sort((a, b) => a.page - b.page || a.id - b.id);
songs.forEach((s, i) => {
  s.id = i + 1;
});

fs.writeFileSync(
  songsOut,
  JSON.stringify(
    {
      title: 'భజనమాల',
      total: songs.length,
      pagesProcessed: files.length,
      songs,
    },
    null,
    2
  ),
  'utf8'
);

console.log('songs', songs.length, 'pages', files.length);
console.log('bad date titles', songs.filter((s) => /\d{1,2}-\d{1,2}-\d{2,4}/.test(s.phrase4)).length);
console.log('sample', songs.slice(0, 5).map((s) => `p${s.page} ${s.phrase4}`));
