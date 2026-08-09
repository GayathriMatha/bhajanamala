/**
 * Rebuild songs: strict PDF centered numbers + OCR title blocks.
 * Left-side "1." "2." charanams are NOT songs.
 */
import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';

const pdfPath = 'c:/Users/gayat/Downloads/bhajanamala.pdf';
const textDir = 'c:/Users/gayat/Downloads/bhajanamala_ocr';
const topicsPath = new URL('../src/data/topics.json', import.meta.url);
const songsOut = new URL('../src/data/songs.json', import.meta.url);
const topic1Path = new URL('./topic1-titles.json', import.meta.url);
const topic2Path = new URL('./topic2-titles.json', import.meta.url);
const topic3Path = new URL('./topic3-titles.json', import.meta.url);

const topicsData = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
const topics = topicsData.topics.map((t, i) => ({
  ...t,
  index: i + 1,
  start: t.page,
  end: topicsData.topics[i + 1] ? topicsData.topics[i + 1].page - 1 : 391,
}));

const MID_PAGE_TOPIC = { 157: { fromSongNo: 63 } };

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/[|॥।.,!?"'`[\](){}-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLine(s) {
  return (s || '')
    .replace(/[|॥।.,!?"'`[\](){}]+/g, ' ')
    .replace(/[\u200c\u200d]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstWords(line, n = 4) {
  return cleanLine(line).split(' ').filter(Boolean).slice(0, n).join(' ');
}

const SECTION_HEADERS = new Set();
for (const t of topics) {
  SECTION_HEADERS.add(normalize(t.topic));
  SECTION_HEADERS.add(normalize(t.topic.replace(/^\u0c36\u0c4d\u0c30\u0c40\s*/, '')));
  const parts = t.topic.split(/\s+/);
  if (parts.length >= 3) {
    SECTION_HEADERS.add(normalize(parts.slice(0, Math.ceil(parts.length / 2)).join(' ')));
    SECTION_HEADERS.add(normalize(parts.slice(-2).join(' ')));
  }
}
for (const e of [
  '\u0c2d\u0c1c\u0c28\u0c2e\u0c3e\u0c32',
  '\u0c06\u0c23\u0c3f\u0c2e\u0c41\u0c24\u0c4d\u0c2f\u0c3e\u0c32\u0c41',
  '\u0c06\u0c23\u0c3f\u0c2e\u0c41\u0c24\u0c4d\u0c2e\u0c3e\u0c32\u0c41',
  '\u0c24\u0c24\u0c4d\u0c35\u0c3e\u0c32\u0c41',
  '\u0c24\u0c24\u0c4d\u0c24\u0c4d\u0c35\u0c3e\u0c32\u0c41',
  '\u0c2a\u0c26\u0c4d\u0c2e\u0c3e\u0c32\u0c41, \u0c36\u0c4d\u0c32\u0c4b\u0c15\u0c3e\u0c32\u0c41',
  '\u0c2a\u0c26\u0c4d\u0c2f\u0c3e\u0c32\u0c41, \u0c36\u0c4d\u0c32\u0c4b\u0c15\u0c3e\u0c32\u0c41',
  '\u0c36\u0c40 \u0c17\u0c2f\u0c32',
  // OCR often swaps ప/వ in పద్యరత్నములు
  '\u0c17\u0c41\u0c30\u0c41\u0c26\u0c47\u0c35\u0c41\u0c32\u0c41 \u0c2e\u0c46\u0c1a\u0c4d\u0c1a\u0c3f\u0c28 \u0c35\u0c26\u0c4d\u0c2f\u0c30\u0c24\u0c4d\u0c28\u0c2e\u0c41\u0c32\u0c41',
]) {
  SECTION_HEADERS.add(normalize(e));
}

function isSectionHeader(line) {
  const t = normalize(line);
  if (!t || t.length < 4) return false;
  if (SECTION_HEADERS.has(t)) return true;
  for (const h of SECTION_HEADERS) {
    if (!h || h.length < 6) continue;
    if (t === h) return true;
    if (t.startsWith(h) && t.length <= h.length + 12) return true;
    if (h.startsWith(t) && t.length >= 10) return true;
  }
  if (
    /(కీర్తనలు|పాటలు|స్తుతి|పద్యరత్న|వద్యరత్న|శ్లోకాలు|ముత్యాలు|ముత్మాలు|ముత్మాలు)/.test(
      t
    ) &&
    t.length < 60
  ) {
    return true;
  }
  return false;
}

function isNoise(line) {
  const t = normalize(line);
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true;
  if (/^\d{1,3}[.)]/.test(String(line).trim())) return true;
  if (/\d{1,2}-\d{1,2}-\d{2,4}/.test(t)) return true;
  if (/^(ది|తేది|తేదీ)\b/.test(t)) return true;
  if (
    /వాకింగ్|ప్రసాదించిన బోధ|ఉదయం శ్రీ|సాయంత్రం|భో�ం శ్రీ|సాయంత్రం|భోజన సమయ/.test(t) &&
    t.length > 18
  ) {
    return true;
  }
  if (/^\(.*\)$/.test(String(line).trim())) return true;
  if (/విరచితం|పూజ్య శ్రీ/.test(t) && t.length < 55) return true;
  if (/^రాగం\b/.test(t) && t.length < 45) return true;
  if (/^(క్షే|శే|శీ|శో|శై|శ్రే|లై|ర్|త్త|క్ష|క)$/i.test(t)) return true;
  if (/^(సీ|శా|ఉ|చం|శ్లో)\.?$/i.test(t)) return true;
  if (!/[\u0C00-\u0C7F]/.test(line) && t.length < 20) return true;
  return false;
}

function topicFor(page, songNo) {
  const mid = MID_PAGE_TOPIC[page];
  if (mid && songNo < mid.fromSongNo) {
    const idx = topics.findIndex((t) => t.start === page);
    if (idx > 0) return topics[idx - 1];
  }
  let found = topics[0];
  for (const t of topics) {
    if (page >= t.start) found = t;
  }
  return found;
}

function pageOcrLines(page) {
  const f = path.join(textDir, `page-${page}.txt`);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function centeredSongNumbers(page, pageIndex) {
  const mediabox = page.getBounds();
  const pageW = mediabox[2] - mediabox[0];
  const pageH = mediabox[3] - mediabox[1];
  const data = JSON.parse(page.toStructuredText('preserve-spans').asJSON());
  const nums = [];

  for (const block of data.blocks || []) {
    for (const line of block.lines || []) {
      const raw = line.text || '';
      // left charanams look like "1."
      if (/^\s*\d{1,3}\.\s*$/.test(raw)) continue;
      const text = raw.trim();
      if (!/^\d{1,3}$/.test(text)) continue;
      const n = Number(text);
      if (n < 1 || n > 300) continue;

      const b = line.bbox;
      const cx = b.x + b.w / 2;
      const fontSize = line.font?.size || b.h;
      const fontName = line.font?.name || '';
      if (b.y > pageH * 0.9) continue; // page number zone

      const centerDist = Math.abs(cx - pageW / 2) / pageW;
      const isPriyaanka = /Priyaanka/i.test(fontName);
      const isCentered = centerDist < 0.14;
      const isLarge = fontSize >= 18;
      if (!(isCentered && (isLarge || isPriyaanka))) continue;
      if (cx < pageW * 0.25 && !isPriyaanka) continue;

      nums.push({ songNo: n, y: b.y, fontSize, centerDist });
    }
  }

  nums.sort((a, b) => a.y - b.y || a.songNo - b.songNo);
  const uniq = [];
  for (const item of nums) {
    const last = uniq[uniq.length - 1];
    // Same digit often appears as stacked/outline spans — keep one per songNo.
    if (
      last &&
      (last.songNo === item.songNo || Math.abs(last.y - item.y) < 28)
    ) {
      if (item.centerDist < last.centerDist || item.fontSize > last.fontSize) {
        uniq[uniq.length - 1] = item;
      }
      continue;
    }
    uniq.push(item);
  }
  // Final: one marker per song number on the page (best centered/largest).
  const best = new Map();
  for (const item of uniq) {
    const prev = best.get(item.songNo);
    if (
      !prev ||
      item.centerDist < prev.centerDist ||
      item.fontSize > prev.fontSize
    ) {
      best.set(item.songNo, item);
    }
  }
  return [...best.values()].sort((a, b) => a.y - b.y || a.songNo - b.songNo);
}

function isSubtitleLine(line) {
  const t = String(line || '');
  return /వద్యములు|పద్యములు/.test(t) && t.length < 45;
}

function titleStartsFromOcr(page, markers) {
  const lines = pageOcrLines(page);
  let i = 0;
  while (
    i < lines.length &&
    (lines[i] === '\u0c2d\u0c1c\u0c28\u0c2e\u0c3e\u0c32' ||
      isSectionHeader(lines[i]) ||
      isNoise(lines[i]) ||
      isSubtitleLine(lines[i]))
  ) {
    i++;
  }

  const numbered = [];
  for (let j = 0; j < lines.length; j++) {
    if (!/^\d{1,3}$/.test(lines[j])) continue;
    const n = Number(lines[j]);
    // Bottom page number often equals a song number — only skip trailing ones.
    if (n === page && j >= lines.length - 3) continue;
    let k = j + 1;
    while (k < lines.length && (isNoise(lines[k]) || isSectionHeader(lines[k]))) {
      k++;
    }
    if (k < lines.length) numbered.push({ n, k, at: j });
  }

  const starts = [];
  const used = new Set();
  for (let m = 0; m < markers.length; m++) {
    const want = markers[m].songNo;
    let pick = numbered.findIndex((b, idx) => !used.has(idx) && b.n === want);
    if (pick < 0 && m === 0 && want === 1 && i < lines.length) {
      // Section-opening song often has no leading "1" in OCR.
      starts.push(i);
      continue;
    }
    if (pick >= 0) {
      used.add(pick);
      starts.push(numbered[pick].k);
    } else {
      starts.push(-1);
    }
  }

  // OCR often misreads song digits (e.g. 3 → 8). Unused lone digits still
  // mark real song starts — assign them in page order to unmatched markers.
  const orphans = numbered.filter((_b, idx) => !used.has(idx)).map((b) => b.k);
  let oi = 0;
  for (let m = 0; m < starts.length; m++) {
    if (starts[m] >= 0) continue;
    if (oi < orphans.length) starts[m] = orphans[oi++];
  }

  return { lines, starts };
}

function pickTitleAt(lines, startIdx) {
  if (startIdx < 0) return { title: '', at: -1 };
  for (let j = startIdx; j < Math.min(lines.length, startIdx + 12); j++) {
    let title = lines[j]
      .replace(/^(శో|శీ|శే|శై|శ్రే|లై|శ్లో|సీ|క్షే)\s*[।|॥.]?\s*/u, '')
      .replace(/^॥?శ్టో।\s*/u, '')
      .replace(/^॥?శ్లో॥?\s*/u, '')
      .replace(/^[|[\]]+\s*/u, '')
      .replace(/^\d{1,3}[.)]\s*/u, '')
      .trim();
    if (!title || isNoise(title) || isSectionHeader(title)) continue;
    if (/^\d{1,3}[.)]/.test(title)) continue;
    if (/దివ్యబోధ|వాకింగ్|ప్రసాదించిన/.test(title)) continue;
    if (isSubtitleLine(title)) continue;
    if (title.length < 4) continue;
    return { title, at: j };
  }
  return { title: '', at: -1 };
}

const doc = mupdf.Document.openDocument(
  fs.readFileSync(pdfPath),
  'application/pdf'
);
const totalPages = doc.countPages();
console.log('PDF pages', totalPages);

function isSongGapPrev(prev) {
  if (!prev) return true;
  const t = prev.replace(/[\u200c\u200d]/g, '').trim();
  // Charanam markers ("2. …") are inside a song — not a new-song gap.
  if (/^\d{1,3}[.)]/.test(t)) return false;
  // Do not treat ॥ pallavi ends as new songs (very common mid-song).
  if (/॥/.test(t) && t.length > 3) return false;
  if (isSectionHeader(t)) return true;
  // Short OCR glyph junk that sits between centered song numbers.
  if (t.length <= 2) return true;
  if (
    t.length <= 8 &&
    !/\s/.test(t) &&
    /^(శ్త|శే|శీ|శో|శై|శ్ర|లై|తి|ర్|గే|గ|క్ష|క్త|డీ|డ్త|రి)/.test(t)
  ) {
    return true;
  }
  return false;
}

function pallaviFallbackStarts(lines, markers) {
  // Last resort when OCR has no lone song digits (continuation pages).
  let scan = 0;
  while (
    scan < lines.length &&
    (lines[scan] === '\u0c2d\u0c1c\u0c28\u0c2e\u0c3e\u0c32' ||
      isSectionHeader(lines[scan]) ||
      isNoise(lines[scan]))
  ) {
    scan++;
  }
  // Skip continuation of previous song (refrain tails like "… సద్గురు ప్రభో").
  if (markers[0] && markers[0].songNo > 1) {
    while (scan < lines.length) {
      const L = lines[scan];
      if (isNoise(L) || L.length <= 3) {
        scan++;
        continue;
      }
      if (/సద్గురు\s*\(?\s*ప్రభో|॥స॥|॥హం॥/.test(L)) {
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
    if (isNoise(L) || isSectionHeader(L)) continue;
    if (/^\d{1,3}[.)]/.test(L)) continue;
    if (L.length < 8) continue;
    if (!(j === scan || isSongGapPrev(prev))) continue;
    if (/^\S+\s*-\s*సద్గురు/.test(L) && markers[0]?.songNo > 1) continue;
    cands.push(j);
  }
  return cands;
}

const songs = [];
for (let i = 0; i < totalPages; i++) {
  const pageNum = i + 1;
  const markers = centeredSongNumbers(doc.loadPage(i), i);
  const { lines, starts } = titleStartsFromOcr(pageNum, markers);
  const fallback = pallaviFallbackStarts(lines, markers);
  const claimed = new Set(starts.filter((s) => s >= 0));
  const unusedFallback = fallback.filter((j) => {
    if (claimed.has(j)) return false;
    // near an already-claimed OCR start → same song, skip
    for (const s of claimed) {
      if (Math.abs(s - j) <= 1) return false;
    }
    return true;
  });
  let fb = 0;
  const resolvedStarts = starts.map((s) => {
    if (s >= 0) return s;
    if (fb < unusedFallback.length) return unusedFallback[fb++];
    return -1;
  });

  // Snap each start to the real title line so later songs cannot reuse it.
  for (let m = 0; m < resolvedStarts.length; m++) {
    if (resolvedStarts[m] < 0) continue;
    const { at } = pickTitleAt(lines, resolvedStarts[m]);
    if (at >= 0) resolvedStarts[m] = at;
  }
  // Drop fallback starts that collide with an earlier song title line.
  const seen = new Set();
  for (let m = 0; m < resolvedStarts.length; m++) {
    const s = resolvedStarts[m];
    if (s < 0) continue;
    if (seen.has(s)) {
      resolvedStarts[m] = -1;
      continue;
    }
    seen.add(s);
  }

  for (let m = 0; m < markers.length; m++) {
    const marker = markers[m];
    let startAt = resolvedStarts[m];
    let title = '';
    if (startAt >= 0) {
      const picked = pickTitleAt(lines, startAt);
      title = picked.title;
      if (picked.at >= 0) startAt = picked.at;
    }
    if (!title && fb < unusedFallback.length) {
      while (fb < unusedFallback.length && seen.has(unusedFallback[fb])) fb++;
      if (fb < unusedFallback.length) {
        startAt = unusedFallback[fb++];
        const picked = pickTitleAt(lines, startAt);
        title = picked.title;
        if (picked.at >= 0) startAt = picked.at;
        if (startAt >= 0) seen.add(startAt);
        resolvedStarts[m] = startAt;
      }
    }

    const lyricLines = [];
    if (startAt >= 0) {
      const to =
        m + 1 < resolvedStarts.length && resolvedStarts[m + 1] >= 0
          ? resolvedStarts[m + 1]
          : Math.min(lines.length, startAt + 25);
      for (let j = startAt; j < to; j++) {
        if (isSectionHeader(lines[j])) continue;
        lyricLines.push(lines[j]);
      }
    }
    if (!title || isNoise(title) || isSectionHeader(title)) {
      title = `\u0c2a\u0c3e\u0c1f ${marker.songNo}`;
    }
    // tidy OCR junk around titles
    title = title
      .replace(/^[[\]|]+\s*/u, '')
      .replace(/\s*[[\]|]+\s*$/u, '')
      .replace(/\s+/g, ' ')
      .trim();

    const topic = topicFor(pageNum, marker.songNo);
    songs.push({
      id: songs.length + 1,
      songNo: marker.songNo,
      page: pageNum,
      section: topic.topic,
      topicPage: topic.start,
      phrase3: firstWords(title, 3) || title,
      phrase4: firstWords(title, 4) || title,
      opening: firstWords(title, 14) || title,
      title,
      lyrics: lyricLines.join('\n').trim(),
      source: 'centered-song-number + ocr-title-blocks + topics',
    });
  }
  if (pageNum % 50 === 0) console.log('page', pageNum, 'songs', songs.length);
}

function applyManualTitles(filePath) {
  if (!fs.existsSync(filePath)) return;
  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const row of rows) {
    const s = songs.find((x) => x.page === row.page && x.songNo === row.songNo);
    if (!s) continue;
    s.title = row.title;
    s.opening = row.title;
    s.phrase3 = firstWords(row.title, 3);
    s.phrase4 = firstWords(row.title, 4);
  }
}
applyManualTitles(topic1Path);
applyManualTitles(topic2Path);
applyManualTitles(topic3Path);

songs.forEach((s, i) => {
  s.id = i + 1;
});

fs.writeFileSync(
  songsOut,
  JSON.stringify(
    {
      title: '\u0c2d\u0c1c\u0c28\u0c2e\u0c3e\u0c32',
      total: songs.length,
      pagesProcessed: totalPages,
      method: 'centered-song-number + ocr-title-blocks + topics',
      note: 'Song = large centered number. Left 1. 2. are charanams, not songs.',
      songs,
    },
    null,
    2
  ),
  'utf8'
);

const counts = new Map();
for (const s of songs) counts.set(s.topicPage, (counts.get(s.topicPage) || 0) + 1);
console.log('\nTOTAL', songs.length);
topics.forEach((t, i) => {
  console.log(
    String(i + 1).padStart(2) + '.',
    String(counts.get(t.start) || 0).padStart(4),
    t.topic
  );
});
console.log('\nTopic2 (aanimutyalu):');
songs
  .filter((s) => s.topicPage === 4)
  .slice(0, 10)
  .forEach((s, i) =>
    console.log(i + 1, 'p' + s.page + '#' + s.songNo, s.title.slice(0, 65))
  );
console.log('\nTopic4 (guru keertanalu):');
songs
  .filter((s) => s.topicPage === 40)
  .slice(0, 8)
  .forEach((s, i) =>
    console.log(i + 1, 'p' + s.page + '#' + s.songNo, s.title.slice(0, 65))
  );
console.log(
  '\nplaceholders',
  songs.filter((s) => /^పాట\s*\d+$/.test(s.title)).length
);
