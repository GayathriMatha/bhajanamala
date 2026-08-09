/**
 * Retitle songs using PDF centered song-number yFrac + OCR lone digits.
 * Does not rebuild inventory — only updates title/opening/phrase fields.
 */
import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';

const pdfPath = 'c:/Users/gayat/Downloads/bhajanamala.pdf';
const ocrDir = 'c:/Users/gayat/Downloads/bhajanamala_ocr';
const songsPath = new URL('../src/data/songs.json', import.meta.url);
const topicsPath = new URL('../src/data/topics.json', import.meta.url);
const overrideFiles = [
  './topic1-titles.json',
  './topic2-titles.json',
  './topic3-titles.json',
  './manual-title-fixes.json',
].map((f) => new URL(f, import.meta.url));

const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8')).topics;
const SECTION = new Set(
  topics.flatMap((t) => {
    const n = norm(t.topic);
    return [n, norm(t.topic.replace(/^\u0c36\u0c4d\u0c30\u0c40\s*/, ''))];
  })
);
for (const e of [
  '\u0c2d\u0c1c\u0c28\u0c2e\u0c3e\u0c32',
  '\u0c06\u0c23\u0c3f\u0c2e\u0c41\u0c24\u0c4d\u0c2f\u0c3e\u0c32\u0c41',
  '\u0c06\u0c23\u0c3f\u0c2e\u0c41\u0c24\u0c4d\u0c2e\u0c3e\u0c32\u0c41',
  '\u0c24\u0c24\u0c4d\u0c35\u0c3e\u0c32\u0c41',
  '\u0c36\u0c4d\u0c30\u0c40\u0c38\u0c26\u0c4d\u0c17\u0c41\u0c30\u0c41 \u0c2a\u0c4d\u0c30\u0c38\u0c3e\u0c26\u0c2e\u0c41',
]) {
  SECTION.add(norm(e));
}

function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/[|॥।.,!?"'`[\](){}:\-]+/g, ' ')
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
  if (/^(\u0c26\u0c3f|\u0c24\u0c47\u0c26\u0c3f|\u0c24\u0c47\u0c26\u0c40)\b/.test(t)) {
    return true;
  }
  if (/^\(.*\)$/.test(raw)) return true;
  if (t.startsWith('\u0c30\u0c3e\u0c17\u0c02') || t.startsWith('\u0c24\u0c3e\u0c33\u0c02')) {
    return true;
  }
  if (/\u0c30\u0c3e\u0c17\u0c02\s*:/.test(t) && t.length < 60) return true;
  // lone raga-name lines like కాఫీరాగం / లలితవసంత
  if (/\u0c30\u0c3e\u0c17\u0c02$/.test(t) && t.length < 24 && !/\s/.test(t)) return true;
  if (/^రాగం\s*[:：]/.test(raw) || /^రాగం\s*[:：]/.test(t)) return true;
  if (
    /^(\u0c06\u0c26\u0c3f|\u0c30\u0c42\u0c2a\u0c15\u0c2e\u0c41|\u0c30\u0c42\u0c2a\u0c15\u0c02|\u0c1a\u0c3e\u0c2a\u0c41|\u0c24\u0c4d\u0c30\u0c3f\u0c2a\u0c41\u0c1f|\u0c05\u0c1f\u0c24\u0c3e\u0c33)/.test(
      t
    ) &&
    t.length < 20
  ) {
    return true;
  }
  if (
    /(\u0c35\u0c3e\u0c15\u0c3f\u0c02\u0c17\u0c4d|\u0c2a\u0c4d\u0c30\u0c38\u0c3e\u0c26\u0c3f\u0c02\u0c1a\u0c3f\u0c28|\u0c2d\u0c4b\u0c1c\u0c28 \u0c38\u0c2e\u0c2f|\u0c09\u0c26\u0c2f\u0c02|\u0c38\u0c3e\u0c2f\u0c02\u0c24\u0c4d\u0c30\u0c02|\u0c2e\u0c3e\u0c32\u0c3f\u0c37\u0c4d|\u0c21\u0c3e\u0c2c\u0c3e|\u0c24\u0c3f\u0c30\u0c41\u0c2a\u0c24\u0c3f|\u0c35\u0c48\u0c1c\u0c3e\u0c17\u0c4d|\u0c39\u0c48\u0c26\u0c30\u0c3e\u0c2c\u0c3e\u0c26\u0c41|\u0c2a\u0c4a\u0c02\u0c26\u0c41\u0c2a\u0c30\u0c1a|\u0c2e\u0c41\u0c02\u0c1c\u0c35\u0c30\u0c2a\u0c41|\u0c2a\u0c4d\u0c30\u0c24\u0c3f\u0c28\u0c3f\u0c24\u0c4d\u0c2f\u0c2e\u0c41)/.test(
      t
    ) &&
    t.length > 16
  ) {
    return true;
  }
  if (
    /(\u0c35\u0c3f\u0c30\u0c1a\u0c3f\u0c24\u0c02|\u0c2a\u0c42\u0c1c\u0c4d\u0c2f \u0c36\u0c4d\u0c30\u0c40|\u0c05\u0c02\u0c1c\u0c32\u0c3f\s*-)/.test(
      t
    ) &&
    t.length < 60
  ) {
    return true;
  }
  if (
    /(\u0c35\u0c26\u0c4d\u0c2f\u0c2e\u0c41\u0c32\u0c41|\u0c2a\u0c26\u0c4d\u0c2f\u0c2e\u0c41\u0c32\u0c41)/.test(
      t
    ) &&
    t.length < 45
  ) {
    return true;
  }
  if (SECTION.has(t)) return true;
  for (const h of SECTION) {
    if (h.length >= 8 && (t === h || (t.startsWith(h) && t.length <= h.length + 10))) {
      return true;
    }
  }
  if (
    /(\u0c15\u0c40\u0c30\u0c4d\u0c24\u0c28\u0c32\u0c41|\u0c2a\u0c3e\u0c1f\u0c32\u0c41|\u0c38\u0c4d\u0c24\u0c41\u0c24\u0c3f|\u0c2a\u0c26\u0c4d\u0c2f\u0c30\u0c24\u0c4d\u0c28|\u0c35\u0c26\u0c4d\u0c2f\u0c30\u0c24\u0c4d\u0c28|\u0c36\u0c4d\u0c32\u0c4b\u0c15\u0c3e\u0c32\u0c41|\u0c2e\u0c41\u0c24\u0c4d\u0c2f\u0c3e\u0c32\u0c41|\u0c2e\u0c41\u0c24\u0c4d\u0c2e\u0c3e\u0c32\u0c41)/.test(
      t
    ) &&
    t.length < 55
  ) {
    return true;
  }
  // lone "పద్యం॥" / short form labels
  if (/^[\u0c2a\u0c35]\u0c26\u0c4d\u0c2f\u0c02/.test(t) && t.length < 12) return true;
  // OCR digit garbage / notation crumbs
  if (isOcrGarbage(raw)) return true;

  const crumb = raw.replace(/[\u200c\u200d]/g, '');
  if (
    t.length <= 8 &&
    !/\s/.test(raw) &&
    /^(\u0c36\u0c4d\u0c24|\u0c36\u0c47|\u0c36\u0c40|\u0c36\u0c4b|\u0c36\u0c48|\u0c36\u0c4d\u0c30|\u0c32\u0c48|\u0c24\u0c3f|\u0c30\u0c4d|\u0c17\u0c47|\u0c17|\u0c15\u0c4d\u0c37|\u0c15\u0c4d\u0c24|\u0c21\u0c40|\u0c21\u0c4d\u0c24|\u0c30\u0c3f|\u0c2d\u0c4d|\u0c2e\u0c4d\u0c2f)/.test(
      crumb
    )
  ) {
    return true;
  }
  // Allow English titles (Why fear / Arise…) — only skip short non-Telugu crumbs
  if (!/[\u0C00-\u0C7F]/.test(raw) && !/[A-Za-z]{3,}/.test(raw) && t.length < 24) {
    return true;
  }
  return false;
}

function isOcrGarbage(line) {
  const raw = String(line || '').trim();
  if (!raw) return true;
  // mostly digits / punctuation / Telugu digits with almost no letters
  const letters = (raw.match(/[\u0C00-\u0C7Fa-zA-Z]/g) || []).length;
  const junk = (raw.match(/[\d%?|/\\\[\](){}<>^=+_~`'@#$&*;:.,!\u0c66-\u0c6f]/g) || [])
    .length;
  if (letters <= 2 && junk >= 4) return true;
  if (/^\d{1,3}[\u0c30\u0c4d\u200c]*[\u0c30\u0c4d\u200c]*$/.test(raw.replace(/\s/g, ''))) {
    return true; // 1ర్‌ర్‌ style fake digits
  }
  if (/^[\u0c30\u0c4d\u200c\d]{1,6}$/.test(raw.replace(/\s/g, ''))) return true;
  return false;
}

function tidy(line) {
  let s = String(line || '')
    .replace(/^[!|¡]\s*/u, '')
    .replace(/^-\s*/u, '')
    .replace(/^[''"]?\u0c2a\u0964\s*/u, '')
    .replace(/^[''"]?\u0c2a\u0c4d\u0c2a\u0964\s*/u, '')
    .replace(/^[''"]?ప॥\s*/u, '')
    .replace(/^['"`]?\u0c2a॥\s*/u, '')
    .replace(/^\u0c38\u0c4d\u0c30\u0c40\s*/u, '\u0c38\u0c40 ')
    // OCR స్రీ → సీ (padya marker), but never break సీతా / సీతమ్మ
    .replace(/^\u0c38\u0c4d\u0c30\u0c40(?=\s)/u, '\u0c38\u0c40')
    .replace(/^\u0c38\u0c4d\u0c30\u0c40(?=[\u0c28\u0c26\u0c2e])/u, '\u0c38\u0c40')
    .replace(/^\u0c8a\u0c09\s*/u, '\u0c09\u0964 ')
    .replace(/^నామం\s*॥?\s*/u, '')
    .replace(
      // strip short OCR crumbs; keep సీ / శ్లోక markers when followed by space+text
      /^(?!\u0c38\u0c40[\u0c24\u0c28])(\u0c36\u0c4b|\u0c36\u0c40|\u0c36\u0c47|\u0c36\u0c48|\u0c36\u0c4d\u0c30\u0c47|\u0c32\u0c48|\u0c36\u0c4d\u0c32\u0c4b|\u0c38\u0c40|\u0c15\u0c4d\u0c37\u0c47)\s*[।|॥.]?\s*/u,
      (m, g) => (g === '\u0c38\u0c40' || g === '\u0c36\u0c4d\u0c32\u0c4b' ? `${g} ` : '')
    )
    .replace(/^॥?\u0c36\u0c4d\u0c1f\u0c4b।\s*/u, '')
    .replace(/^॥?\u0c36\u0c4d\u0c32\u0c4b॥?\s*/u, '')
    .replace(/^(\u0c1a\u0c02|\u0c36\u0c3e|\u0c09)[!।]\s*/u, '$1॥ ')
    .replace(/^\u0c38\u0c40॥\s*/u, '\u0c38\u0c40 ')
    .replace(/^\(\s*/u, '')
    .replace(/^[|[\]]+\s*/u, '')
    .replace(/^\d{1,3}[.)]\s*/u, '')
    .replace(/^\d{1,3}\s+(?=[\u0C00-\u0C7F])/u, '')
    .replace(/[[\]|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

function centeredSongNumbers(page) {
  const mediabox = page.getBounds();
  const pageW = mediabox[2] - mediabox[0];
  const pageH = mediabox[3] - mediabox[1];
  const data = JSON.parse(page.toStructuredText('preserve-spans').asJSON());
  const nums = [];

  for (const block of data.blocks || []) {
    for (const line of block.lines || []) {
      const raw = line.text || '';
      if (/^\s*\d{1,3}\.\s*$/.test(raw)) continue;
      const text = raw.trim();
      if (!/^\d{1,3}$/.test(text)) continue;
      const n = Number(text);
      if (n < 1 || n > 300) continue;

      const b = line.bbox;
      const cx = b.x + b.w / 2;
      const fontSize = line.font?.size || b.h;
      const fontName = line.font?.name || '';
      if (b.y > pageH * 0.9) continue;

      const centerDist = Math.abs(cx - pageW / 2) / pageW;
      const isPriyaanka = /Priyaanka/i.test(fontName);
      const isCentered = centerDist < 0.14;
      const isLarge = fontSize >= 18;
      if (!(isCentered && (isLarge || isPriyaanka))) continue;
      if (cx < pageW * 0.25 && !isPriyaanka) continue;

      nums.push({
        songNo: n,
        y: b.y,
        yFrac: b.y / pageH,
        fontSize,
        centerDist,
      });
    }
  }

  nums.sort((a, b) => a.y - b.y || a.songNo - b.songNo);
  const uniq = [];
  for (const item of nums) {
    const last = uniq[uniq.length - 1];
    if (last && (last.songNo === item.songNo || Math.abs(last.y - item.y) < 28)) {
      if (item.centerDist < last.centerDist || item.fontSize > last.fontSize) {
        uniq[uniq.length - 1] = item;
      }
      continue;
    }
    uniq.push(item);
  }
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

function digitAlias(a, b) {
  // OCR 3↔8 family
  const sa = String(a);
  const sb = String(b);
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] === sb[i]) continue;
    const pair = sa[i] + sb[i];
    if (pair === '38' || pair === '83') diff++;
    else return false;
  }
  return diff >= 1;
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

function isSongGapPrev(prev) {
  if (!prev) return true;
  const t = prev.replace(/[\u200c\u200d]/g, '').trim();
  if (/^\d{1,3}[.)]/.test(t)) return false;
  if (/॥/.test(t) && t.length > 3) return false;
  if (isNoise(t)) return true;
  if (t.length <= 2) return true;
  if (
    t.length <= 8 &&
    !/\s/.test(t) &&
    /^(\u0c36\u0c4d\u0c24|\u0c36\u0c47|\u0c36\u0c40|\u0c36\u0c4b|\u0c36\u0c48|\u0c36\u0c4d\u0c30|\u0c32\u0c48|\u0c24\u0c3f|\u0c30\u0c4d|\u0c17\u0c47|\u0c17|\u0c15\u0c4d\u0c37|\u0c15\u0c4d\u0c24|\u0c21\u0c40|\u0c21\u0c4d\u0c24|\u0c30\u0c3f)/.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

function pallaviFallback(lines, firstSongNo) {
  let scan = 0;
  while (scan < lines.length && (lines[scan] === '\u0c2d\u0c1c\u0c28\u0c2e\u0c3e\u0c32' || isNoise(lines[scan]))) {
    scan++;
  }
  if (firstSongNo > 1) {
    while (scan < lines.length) {
      const L = lines[scan];
      if (isNoise(L) || L.length <= 3) {
        scan++;
        continue;
      }
      if (
        /\u0c38\u0c26\u0c4d\u0c17\u0c41\u0c30\u0c41\s*\(?\s*\u0c2a\u0c4d\u0c30\u0c2d\u0c4b|॥స॥|॥వెం॥|॥మమ॥|॥హం॥/.test(
          L
        )
      ) {
        scan++;
        continue;
      }
      if (/^\S+\s*-\s*\u0c38\u0c26\u0c4d\u0c17\u0c41\u0c30\u0c41/.test(L)) {
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
    if (!(j === scan || isSongGapPrev(prev))) continue;
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

function resolveStarts(lines, markers, page) {
  const numbered = numberedStarts(lines, page);
  const used = new Set();
  const starts = markers.map(() => -1);
  const N = Math.max(lines.length - 1, 1);

  // 1) exact digit, nearest yFrac
  for (let m = 0; m < markers.length; m++) {
    const want = markers[m].songNo;
    const approx = Math.round(markers[m].yFrac * N);
    let best = -1;
    let bestDist = Infinity;
    for (let idx = 0; idx < numbered.length; idx++) {
      if (used.has(idx)) continue;
      if (numbered[idx].n !== want) continue;
      const d = Math.abs(numbered[idx].at - approx);
      if (d < bestDist) {
        bestDist = d;
        best = idx;
      }
    }
    if (best >= 0) {
      used.add(best);
      starts[m] = numbered[best].k;
    }
  }

  // 2) digit aliases near approx
  for (let m = 0; m < markers.length; m++) {
    if (starts[m] >= 0) continue;
    const want = markers[m].songNo;
    const approx = Math.round(markers[m].yFrac * N);
    let best = -1;
    let bestDist = Infinity;
    for (let idx = 0; idx < numbered.length; idx++) {
      if (used.has(idx)) continue;
      if (!digitAlias(numbered[idx].n, want)) continue;
      const d = Math.abs(numbered[idx].at - approx);
      if (d > 6) continue;
      if (d < bestDist) {
        bestDist = d;
        best = idx;
      }
    }
    if (best >= 0) {
      used.add(best);
      starts[m] = numbered[best].k;
    }
  }

  // 3) orphans in y-order
  const orphans = numbered
    .map((b, idx) => ({ ...b, idx }))
    .filter((b) => !used.has(b.idx))
    .sort((a, b) => a.at - b.at);
  let oi = 0;
  for (let m = 0; m < markers.length; m++) {
    if (starts[m] >= 0) continue;
    if (oi < orphans.length) {
      used.add(orphans[oi].idx);
      starts[m] = orphans[oi].k;
      oi++;
    }
  }

  // 4) section-open song 1 BEFORE y-window (avoids picking 2nd pallavi line)
  if (markers.length && markers[0].songNo === 1 && starts[0] < 0) {
    let i = 0;
    while (
      i < lines.length &&
      (lines[i] === '\u0c2d\u0c1c\u0c28\u0c2e\u0c3e\u0c32' || isNoise(lines[i]))
    ) {
      i++;
    }
    if (i < lines.length) starts[0] = i;
  }

  // 5) y-window / pallavi fallback
  const fallback = pallaviFallback(lines, markers[0]?.songNo || 1);
  const claimed = new Set(starts.filter((s) => s >= 0));
  const unusedFb = fallback.filter((j) => {
    if (claimed.has(j)) return false;
    for (const s of claimed) if (Math.abs(s - j) <= 1) return false;
    return true;
  });
  let fb = 0;
  for (let m = 0; m < markers.length; m++) {
    if (starts[m] >= 0) continue;
    const approx = Math.round(markers[m].yFrac * N);
    let win = -1;
    let winDist = Infinity;
    for (let j = Math.max(0, approx - 2); j <= Math.min(lines.length - 1, approx + 8); j++) {
      if (isNoise(lines[j])) continue;
      if (/^\d{1,3}[.)]/.test(lines[j])) continue;
      if (lines[j].length < 6) continue;
      if (claimed.has(j)) continue;
      const d = Math.abs(j - approx);
      if (d < winDist) {
        winDist = d;
        win = j;
      }
    }
    if (win >= 0) {
      starts[m] = win;
      claimed.add(win);
      continue;
    }
    if (fb < unusedFb.length) {
      starts[m] = unusedFb[fb++];
      claimed.add(starts[m]);
    }
  }

  return starts;
}

const doc = mupdf.Document.openDocument(
  fs.readFileSync(pdfPath),
  'application/pdf'
);
const data = JSON.parse(fs.readFileSync(songsPath, 'utf8'));
const songs = data.songs;

const markersByPage = new Map();
for (let i = 0; i < doc.countPages(); i++) {
  const pageNum = i + 1;
  markersByPage.set(pageNum, centeredSongNumbers(doc.loadPage(i)));
}

let retitled = 0;
let placeholders = 0;

const byPage = new Map();
for (const s of songs) {
  if (!byPage.has(s.page)) byPage.set(s.page, []);
  byPage.get(s.page).push(s);
}

for (const [page, pageSongs] of byPage) {
  pageSongs.sort((a, b) => a.songNo - b.songNo || a.id - b.id);
  const lines = ocrLines(page);
  let markers = markersByPage.get(page) || [];
  // Align markers to existing inventory if counts differ (prefer inventory order)
  if (markers.length !== pageSongs.length) {
    // Match by songNo when possible
    const mapped = pageSongs.map((s) => {
      const hit = markers.find((m) => m.songNo === s.songNo);
      if (hit) return hit;
      // invent yFrac from relative index
      const idx = pageSongs.indexOf(s);
      return {
        songNo: s.songNo,
        yFrac: (idx + 1) / (pageSongs.length + 1),
        y: 0,
        fontSize: 0,
        centerDist: 1,
      };
    });
    markers = mapped;
  } else {
    // ensure songNo alignment
    markers = markers.map((m, i) =>
      m.songNo === pageSongs[i].songNo
        ? m
        : { ...m, songNo: pageSongs[i].songNo }
    );
  }

  const starts = resolveStarts(lines, markers, page);
  for (let i = 0; i < pageSongs.length; i++) {
    const s = pageSongs[i];
    let title = titleAt(lines, starts[i]);
    if (!title) {
      title = `\u0c2a\u0c3e\u0c1f ${s.songNo}`;
      placeholders++;
    } else {
      retitled++;
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

for (const s of songs) {
  s.title = tidy(s.title);
  s.opening = s.title;
  s.phrase3 = firstWords(s.title, 3);
  s.phrase4 = firstWords(s.title, 4);
}

data.method = (data.method || '') + ' + geometry-ocr-titles';
fs.writeFileSync(songsPath, JSON.stringify(data, null, 2), 'utf8');

const ph = songs.filter((s) =>
  new RegExp('^\u0c2a\u0c3e\u0c1f\\s*\\d+$').test(s.title)
).length;
console.log('songs', songs.length, 'retitled', retitled, 'placeholders', ph);
topics.forEach((t, i) => {
  const list = songs.filter((s) => s.topicPage === t.page);
  console.log('\n' + String(i + 1).padStart(2) + '. ' + t.topic + ' (' + list.length + ')');
  list.slice(0, 4).forEach((s, j) => console.log('   ' + (j + 1) + '. ' + s.title));
  if (list.length > 4) console.log('   …');
});
