/** Smoke test: search matcher (no browser / no mic). */
import data from '../src/data/songs.json' with { type: 'json' };
import {
  romanizeTelugu,
  normalizeRomanQuery,
  consonantSkeleton,
} from '../src/romanize.js';

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/[|॥।.,!?"'`[\](){}:\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const songs = data.songs.map((song) => {
  const title = song.title || '';
  const titleR = romanizeTelugu(title);
  return {
    title,
    page: song.page,
    _title: normalize(title),
    _titleR: titleR,
    _titleSkel: consonantSkeleton(titleR),
    _roman: romanizeTelugu([title, song.opening, song.lyrics].filter(Boolean).join(' ')),
    _telugu: normalize([title, song.opening, song.lyrics].filter(Boolean).join(' ')),
  };
});

function hit(song, q) {
  const te = normalize(q);
  const ro = normalizeRomanQuery(q);
  const sk = consonantSkeleton(ro);
  if (te && song._title.includes(te)) return 100;
  if (ro && song._titleR.includes(ro)) return 95;
  if (sk.length >= 3 && song._titleSkel.includes(sk)) return 55;
  if (te && song._telugu.includes(te)) return 18;
  if (ro && song._roman.includes(ro)) return 15;
  return 0;
}

let failed = 0;
for (const q of ['govinda', 'rama', 'jaya', 'krishna', 'రామా', 'గోవింద']) {
  const top = songs
    .map((s) => ({ s, score: hit(s, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const ok = top.length > 0;
  console.log(ok ? 'OK' : 'FAIL', q, '→', top.length, 'hits', top[0]?.s.title?.slice(0, 40) || '');
  if (!ok) failed += 1;
}

if (failed) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('search matcher ok');
