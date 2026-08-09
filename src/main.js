import './style.css';
import data from './data/songs.json';
import topicData from './data/topics.json';
import {
  romanizeTelugu,
  normalizeRomanQuery,
  foldRoman,
  consonantSkeleton,
} from './romanize.js';
import { createVoice } from './voice.js';

const app = document.querySelector('#app');
const PAGE_IMG = (page) =>
  `${import.meta.env.BASE_URL}pages/mupdf-page-${page}.png`;

let query = '';
let liveHeard = '';
let listening = false;
let voiceError = '';
let renderTimer = null;
let view = 'topics';
let activeTopicPage = null;
let activeSongId = null;
let viewPage = null;

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'is',
  'it',
  'me',
  'my',
  'నా',
  'నీ',
  'మా',
  'మీ',
  'ఈ',
  'ఆ',
  'ఓ',
  'ఒక',
  'కి',
  'కు',
  'లో',
  'గా',
  'చే',
  'తో',
]);

const topics = topicData.topics.map((t, i) => {
  const start = t.page;
  const end = topicData.topics[i + 1]
    ? topicData.topics[i + 1].page - 1
    : data.pagesProcessed || 391;
  return { ...t, index: i + 1, start, end };
});

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/[|॥।.,!?"'`[\](){}:\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoiseLine(line) {
  const t = normalize(line);
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true;
  if (/\d{1,2}-\d{1,2}-\d{2,4}/.test(t)) return true;
  if (t.length <= 2) return true;
  return false;
}

function looksLikeTopicHeading(line) {
  const t = normalize(line);
  if (!t || t.length < 4) return false;
  for (const topic of topics) {
    const n = normalize(topic.topic);
    if (!n) continue;
    if (t === n) return true;
    if (t.startsWith(n) && t.length <= n.length + 8) return true;
  }
  return false;
}

function lyricLines(song) {
  return String(song.lyrics || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function cleanTitle(song) {
  const candidates = [
    song.title,
    song.opening,
    song.phrase4,
    song.phrase3,
    ...lyricLines(song),
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    let line = String(raw).includes(' — ')
      ? String(raw).split(' — ').slice(-1)[0]
      : String(raw);
    line = line.replace(/^[|[\]]+\s*/u, '').trim();
    if (!line || isNoiseLine(line) || looksLikeTopicHeading(line)) continue;
    if (/^\u0c2a\u0c3e\u0c1f\s*\d+$/.test(normalize(line))) continue;
    if (line.length < 4) continue;
    return line;
  }
  if (song.songNo != null) return 'పాట ' + song.songNo;
  return 'పేజీ ' + song.page;
}

function topicForSong(song) {
  if (song.topicPage != null) {
    return topics.find((t) => t.start === song.topicPage) || topics[0];
  }
  let found = topics[0];
  for (const t of topics) {
    if (song.page >= t.start) found = t;
  }
  return found;
}

const songIndex = data.songs.map((song) => {
  const topic = topicForSong(song);
  const title = cleanTitle(song);
  const opening = song.opening || title;
  const titleN = normalize(title);
  const openingN = normalize(opening);
  const phraseN = normalize([song.phrase3, song.phrase4].filter(Boolean).join(' '));
  const lyricsN = normalize(song.lyrics || '');
  const topicN = normalize(song.section || topic?.topic || '');
  const blob = [title, opening, song.phrase3, song.phrase4, song.lyrics, topic?.topic]
    .filter(Boolean)
    .join(' ');
  const titleR = romanizeTelugu(title);
  const openingR = romanizeTelugu(opening);
  const blobR = romanizeTelugu(blob);
  return {
    ...song,
    displayTitle: title,
    topic: song.section || topic?.topic || '',
    topicStart: song.topicPage || topic?.start || 1,
    topicIndex: topic?.index || 0,
    _title: titleN,
    _opening: openingN,
    _phrase: phraseN,
    _lyrics: lyricsN,
    _topic: topicN,
    _telugu: normalize(blob),
    _titleR: titleR,
    _openingR: openingR,
    _roman: blobR,
    _titleSkel: consonantSkeleton(titleR),
    _openSkel: consonantSkeleton(openingR),
  };
});

const topicCounters = new Map();
for (const song of songIndex) {
  const n = (topicCounters.get(song.topicStart) || 0) + 1;
  topicCounters.set(song.topicStart, n);
  song.indexInTopic = n;
}

function queryTokens(q) {
  const n = normalize(q);
  const tokens = [];
  for (const w of n.split(' ').filter(Boolean)) {
    if (STOP_WORDS.has(w)) continue;
    if (w.length < 2) continue;
    tokens.push(w);
  }
  // Also keep full phrase if multi-word
  if (tokens.length >= 2) tokens.unshift(n);
  return [...new Set(tokens)];
}

function tokenHit(song, token) {
  const te = token;
  const ro = normalizeRomanQuery(token);
  const sk = consonantSkeleton(ro);
  let score = 0;
  let where = '';

  const check = (fieldTe, fieldRo, fieldSk, pts, label) => {
    if (!fieldTe && !fieldRo) return;
    if (te && fieldTe.includes(te)) {
      score = Math.max(score, pts);
      where = label;
      return;
    }
    if (ro && fieldRo && fieldRo.includes(ro)) {
      score = Math.max(score, pts - 5);
      where = label;
      return;
    }
    // fuzzy: consonant skeleton (voice often mangled vowels)
    if (sk && sk.length >= 2 && fieldSk && fieldSk.includes(sk)) {
      score = Math.max(score, Math.floor(pts * 0.55));
      where = label;
      return;
    }
    // prefix of longer token
    if (ro && ro.length >= 3 && fieldRo) {
      for (const w of fieldRo.split(' ')) {
        if (w.startsWith(ro) || (ro.startsWith(w) && w.length >= 3)) {
          score = Math.max(score, Math.floor(pts * 0.45));
          where = label;
          break;
        }
      }
    }
  };

  check(song._title, song._titleR, song._titleSkel, 100, 'title');
  check(song._opening, song._openingR, song._openSkel, 80, 'opening');
  check(song._phrase, romanizeTelugu(song._phrase), consonantSkeleton(song._phrase), 60, 'phrase');
  check(song._topic, romanizeTelugu(song._topic), '', 35, 'topic');
  check(song._lyrics || song._telugu, song._roman, '', 18, 'lyrics');

  return { score, where };
}

function scoreSong(song, tokens) {
  if (!tokens.length) return { score: 0, hits: 0 };
  let total = 0;
  let hits = 0;
  let titleHits = 0;
  for (const tok of tokens) {
    // skip duplicate full-phrase token scoring separately handled
    const { score, where } = tokenHit(song, tok);
    if (score > 0) {
      hits += 1;
      total += score;
      if (where === 'title' || where === 'opening') titleHits += 1;
    }
  }
  // Prefer songs where more spoken words land on the title/opening
  total += titleHits * 25;
  total += hits * 8;
  // Slight boost when full query string is inside title
  const full = normalize(query);
  if (full.length >= 4 && song._title.includes(full)) total += 120;
  const fullR = normalizeRomanQuery(full);
  if (fullR.length >= 4 && song._titleR.includes(fullR)) total += 100;
  return { score: total, hits };
}

function rankedSearch(list, q) {
  const tokens = queryTokens(q);
  if (!tokens.length) return list;
  const scored = [];
  for (const song of list) {
    const { score, hits } = scoreSong(song, tokens);
    // Need at least one real hit; for multi-token prefer ≥1 strong or ≥2 weak
    if (score <= 0) continue;
    if (tokens.length >= 3 && hits < 1) continue;
    scored.push({ song, score, hits });
  }
  scored.sort((a, b) => b.score - a.score || a.song.page - b.song.page);
  return scored.slice(0, 60).map((x) => x.song);
}

function songsForTopic(topicStart) {
  return songIndex.filter((s) => s.topicStart === topicStart);
}

function searchResults({ global = false } = {}) {
  const q = normalize(query);
  let list = songIndex;
  if (!global && view === 'songs' && activeTopicPage != null) {
    list = songsForTopic(activeTopicPage);
  }
  if (!q) return list;
  return rankedSearch(list, q);
}

function songListHtml(songs, { showTopic = false } = {}) {
  if (!songs.length) {
    return `<p class="empty">${
      listening ? 'వింటున్నాను… పాట పేరు చెప్పండి' : 'No songs found — try another word'
    }</p>`;
  }
  return `<div class="list">
    ${songs
      .map(
        (song) => `
      <button type="button" class="card song-link" data-id="${song.id}">
        ${
          showTopic
            ? ''
            : `<span class="song-no">${song.indexInTopic}.</span>`
        }
        <span class="song-body">
          <span class="song-title">${esc(song.displayTitle)}</span>
          <span class="song-meta">${
            showTopic ? `${esc(song.topic)} · ` : ''
          }p.${song.page}${song.songNo != null ? ` · #${song.songNo}` : ''}</span>
        </span>
      </button>`
      )
      .join('')}
  </div>`;
}

function scheduleRender(delay = 80) {
  if (view === 'song') return;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => render(), delay);
}

function openTopic(startPage) {
  stopVoice(false);
  activeTopicPage = startPage;
  query = '';
  liveHeard = '';
  view = 'songs';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSong(id) {
  stopVoice(false);
  activeSongId = id;
  const song = songIndex.find((s) => s.id === id);
  viewPage = song?.page || null;
  view = 'song';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function back() {
  if (view === 'song') {
    view = activeTopicPage != null ? 'songs' : 'topics';
    activeSongId = null;
    viewPage = null;
  } else if (view === 'songs') {
    view = 'topics';
    activeTopicPage = null;
    query = '';
    liveHeard = '';
  }
  render();
}


function showHeard(text) {
  query = String(text || '').trim();
  liveHeard = query;
  voiceError = '';
  const input = app.querySelector('#q');
  if (input) input.value = query;
}

function fillSearchOnly(text) {
  const input = app.querySelector('#q');
  if (input) input.value = String(text || '');
}

const voice = createVoice({
  onText(text) {
    if (!listening) return;
    console.log('[app] onText', text);
    showHeard(text);
    // Keep mic on — only Stop (or typing) ends listening
    scheduleRender(80);
  },
  onInterim(text) {
    if (!listening) return;
    liveHeard = String(text || '').trim();
    query = liveHeard;
    fillSearchOnly(liveHeard);
    scheduleRender(120);
  },
  onStatus(msg) {
    console.log('[app] onStatus', msg);
  },
  onEnd() {
    console.log('[app] onEnd query=', query);
    listening = false;
    render();
  },
  onError(msg) {
    console.error('[app] onError', msg);
    listening = false;
    voiceError = msg || '';
    render();
  },
});

function stopVoice(clearHeard = true) {
  clearTimeout(renderTimer);
  voice.stop();
  listening = false;
  if (clearHeard) liveHeard = '';
}

function toggleVoice() {
  if (!voice.supported) {
    window.alert('Voice needs Chrome or Edge.');
    return;
  }
  if (voice.listening || listening) {
    console.log('[app] stop voice');
    stopVoice(false);
    render();
    return;
  }
  console.log('[app] start voice');
  query = '';
  liveHeard = '';
  voiceError = '';
  listening = true;

  // Update button/search only — do NOT rebuild the whole page before start
  // (full render here was breaking Chrome speech)
  const btn = app.querySelector('#voice-btn');
  if (btn) {
    btn.classList.add('listening');
    btn.textContent = 'Stop';
  }
  fillSearchOnly('');
  const live = app.querySelector('.voice-live');
  if (live) live.remove();

  voice.start();
}

function searchChrome() {
  return `
    <div class="search-row">
      <input id="q" class="search" type="search" placeholder="తెలుగులో చెప్పండి లేదా టైప్ చేయండి" value="${esc(query || liveHeard)}" autocomplete="off" enterkeyhint="search" />
      <button type="button" id="voice-btn" class="voice-btn ${listening ? 'listening' : ''}" aria-pressed="${listening}" title="Voice search">
        ${listening ? 'Stop' : 'Voice'}
      </button>
    </div>
    ${voiceError ? `<p class="voice-live">${esc(voiceError)}</p>` : ''}
  `;
}

function renderTopics() {
  const q = normalize(query);
  if (q) {
    const songs = searchResults({ global: true });
    return `
    <div class="shell">
      <h1 class="brand">భజనమాల</h1>
      <p class="subtitle">${listening ? 'వింటున్నాను…' : 'పాటల ఫలితాలు'}</p>
      ${searchChrome()}
      <p class="meta">${songs.length} songs matched${query ? ` · “${esc(query)}”` : ''}</p>
      ${songListHtml(songs, { showTopic: true })}
    </div>
  `;
  }

  return `
    <div class="shell">
      <h1 class="brand">భజనమాల</h1>
      <p class="subtitle">${listening ? 'వింటున్నాను… పాట పేరు చెప్పండి' : 'విభాగాలు (Topics)'}</p>
      ${searchChrome()}
      <p class="meta">${topics.length} topics</p>
      <div class="list">
        ${topics
          .map((t) => {
            const count = songsForTopic(t.start).length;
            return `
              <button type="button" class="card topic-link" data-start="${t.start}">
                <span class="topic-index">${t.index}.</span>
                <span class="topic-body">
                  <span class="topic-name">${esc(t.topic)}</span>
                  <span class="topic-meta">${count} songs · p.${t.start}–${t.end}</span>
                </span>
              </button>`;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderSongs() {
  const topic = topics.find((t) => t.start === activeTopicPage);
  const songs = searchResults();
  const heading = topic?.topic || 'పాటలు';
  return `
    <div class="shell">
      <div class="toolbar">
        <button type="button" class="back-btn" id="back-btn">← Topics</button>
      </div>
      <h1 class="brand small">${esc(heading)}</h1>
      ${searchChrome()}
      <p class="meta">${listening ? 'Listening · ' : ''}${songs.length} songs</p>
      ${songListHtml(songs)}
    </div>
  `;
}

function topicForPage(page) {
  let found = topics[0];
  for (const t of topics) {
    if (page >= t.start) found = t;
  }
  return found;
}

function renderSong() {
  const song = songIndex.find((s) => s.id === activeSongId);
  const page = viewPage || song?.page || 1;
  const topic =
    song && page === song.page ? topicForSong(song) : topicForPage(page);
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < (data.pagesProcessed || 391) ? page + 1 : null;
  return `
    <div class="shell song-shell">
      <div class="song-toolbar">
        <button type="button" class="back-btn" id="back-btn">← Back</button>
        <span class="page-label">${esc(topic?.topic || '')} · p.${page}</span>
        <div class="page-nav">
          <button type="button" class="nav-btn" id="prev-page" ${
            prevPage ? '' : 'disabled'
          }>Prev</button>
          <button type="button" class="nav-btn" id="next-page" ${
            nextPage ? '' : 'disabled'
          }>Next</button>
        </div>
      </div>
      <img class="pdf-page" src="${PAGE_IMG(page)}" alt="page ${page}" />
    </div>
  `;
}

function bind() {
  app.querySelector('#voice-btn')?.addEventListener('click', toggleVoice);
  app.querySelector('#back-btn')?.addEventListener('click', back);
  const input = app.querySelector('#q');
  input?.addEventListener('input', (e) => {
    // Keep typed text first, then release the mic so voice can't overwrite it
    query = e.target.value;
    liveHeard = '';
    const pos = e.target.selectionStart;
    if (listening || voice.listening) {
      stopVoice(false);
    }
    render();
    const next = app.querySelector('#q');
    next?.focus();
    if (next && typeof pos === 'number') next.setSelectionRange(pos, pos);
  });
  app.querySelectorAll('.topic-link').forEach((btn) => {
    btn.addEventListener('click', () => openTopic(Number(btn.dataset.start)));
  });
  app.querySelectorAll('.song-link').forEach((btn) => {
    btn.addEventListener('click', () => openSong(Number(btn.dataset.id)));
  });
  app.querySelector('#prev-page')?.addEventListener('click', () => {
    if (viewPage > 1) {
      viewPage -= 1;
      render();
    }
  });
  app.querySelector('#next-page')?.addEventListener('click', () => {
    if (viewPage < (data.pagesProcessed || 391)) {
      viewPage += 1;
      render();
    }
  });
}

function render() {
  if (view === 'song') app.innerHTML = renderSong();
  else if (view === 'songs') app.innerHTML = renderSongs();
  else app.innerHTML = renderTopics();
  bind();
}

render();
