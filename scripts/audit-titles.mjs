/**
 * Audit every song title against OCR on its page.
 * Flags: placeholder, noise/raga/date, missing digit match, title not on page.
 */
import fs from 'fs';
import path from 'path';

const ocrDir = 'c:/Users/gayat/Downloads/bhajanamala_ocr';
const data = JSON.parse(
  fs.readFileSync(new URL('../src/data/songs.json', import.meta.url), 'utf8')
);
const topics = JSON.parse(
  fs.readFileSync(new URL('../src/data/topics.json', import.meta.url), 'utf8')
).topics;

function lines(page) {
  const f = path.join(ocrDir, `page-${page}.txt`);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function norm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/[|॥।.,!?"'`[\](){}:\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBadTitle(t) {
  const n = norm(t);
  if (!n || n.length < 4) return 'short';
  if (/^పాట\s*\d+$/.test(t.trim())) return 'placeholder';
  // raga *label* only — pallavis may contain the word రాగం
  if (/^రాగం/.test(n)) return 'raga';
  if (/రాగం$/.test(n) && !/\s/.test(n) && n.length < 24) return 'raga';
  if (/\d{1,2}-\d{1,2}-\d{2,4}/.test(n)) return 'date';
  if (/వాకింగ్|ప్రసాదించిన|పొందుపరచ|ముంజవరపు/.test(n)) return 'note';
  if (/^(ఆది|రూపక|చాపు|తాళం)\b/.test(n) && n.length < 24) return 'tala';
  if (/(కీర్తనలు|పాటలు|స్తుతి|పద్యరత్న|వద్యరత్న)$/.test(n) && n.length < 50) {
    return 'section';
  }
  if (/^\d{1,3}\s/.test(t.trim())) return 'leading-num';
  // OCR digit soup
  const letters = (t.match(/[\u0C00-\u0C7Fa-zA-Z]/g) || []).length;
  const junk = (t.match(/[\d%?|/\\\[\](){}<>^=+_~]/g) || []).length;
  if (letters <= 3 && junk >= 4) return 'garbage';
  return null;
}

function fuzzyNorm(s) {
  return norm(s)
    .replace(/స్రీ/g, 'సీ')
    .replace(/కర్తుభ్యో/g, 'కర్తృభ్యో')
    .replace(/పబ్రహ్మ/g, 'బ్రహ్మ')
    .replace(/జ్జ్జాన/g, 'జ్ఞాన')
    .replace(/[\/\\|]+/g, ' ')
    .replace(/\s+/g, '');
}

function onPage(title, pageLines) {
  // English titles often exist in PDF but OCR destroyed them
  if (/[a-z]{4,}/i.test(title)) {
    const eng = title.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
    const words = eng.split(/\s+/).filter((w) => w.length >= 4).slice(0, 3);
    if (
      words.length &&
      pageLines.some((L) => {
        const pl = L.toLowerCase().replace(/[^a-z]+/g, ' ');
        return words.every((w) => pl.includes(w));
      })
    ) {
      return true;
    }
    // accept known PDF-only English openings
    if (/why fear|arise.*awake|happy new year/i.test(title)) return true;
  }
  const nt = fuzzyNorm(title).slice(0, 14);
  if (nt.length < 5) return false;
  return pageLines.some((L) => {
    const nl = fuzzyNorm(L);
    return nl.includes(nt) || nt.includes(nl.slice(0, 14));
  });
}

const issues = [];
for (const s of data.songs) {
  const ls = lines(s.page);
  const bad = isBadTitle(s.title);
  const present = onPage(s.title, ls);
  if (bad || !present) {
    issues.push({
      topicPage: s.topicPage,
      songNo: s.songNo,
      page: s.page,
      title: s.title.slice(0, 55),
      bad: bad || (!present ? 'not-on-page' : null),
    });
  }
}

const byTopic = new Map();
for (const i of issues) {
  if (!byTopic.has(i.topicPage)) byTopic.set(i.topicPage, []);
  byTopic.get(i.topicPage).push(i);
}

console.log('TOTAL issues', issues.length, '/', data.songs.length);
for (const t of topics) {
  const list = byTopic.get(t.page) || [];
  const total = data.songs.filter((s) => s.topicPage === t.page).length;
  console.log(
    String(topics.indexOf(t) + 1).padStart(2) + '.',
    String(list.length).padStart(3) + '/' + String(total).padStart(3),
    t.topic.slice(0, 40)
  );
  for (const x of list.slice(0, 4)) {
    console.log('   #' + x.songNo, 'p' + x.page, '[' + x.bad + ']', x.title);
  }
  if (list.length > 4) console.log('   … +' + (list.length - 4));
}
