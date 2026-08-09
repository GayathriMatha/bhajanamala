const fs = require('fs');

const te = {
  brand: '\u0c2d\u0c1c\u0c28\u0c2e\u0c3e\u0c32',
  topicsLabel: '\u0c35\u0c3f\u0c2d\u0c3e\u0c17\u0c3e\u0c32\u0c41 (Topics)',
  searchTopic:
    '\u0c35\u0c3f\u0c2d\u0c3e\u0c17\u0c02 / \u0c2a\u0c3e\u0c1f \u0c35\u0c46\u0c24\u0c15\u0c02\u0c21\u0c3f',
  searchIn:
    '\u0c08 \u0c35\u0c3f\u0c2d\u0c3e\u0c17\u0c02\u0c32\u0c4b \u0c35\u0c46\u0c24\u0c15\u0c02\u0c21\u0c3f',
  songs: '\u0c2a\u0c3e\u0c1f\u0c32\u0c41',
  song: '\u0c2a\u0c3e\u0c1f',
  pageWord: '\u0c2a\u0c47\u0c1c\u0c40',
};

const src = `import './style.css';
import data from './data/songs.json';
import topicData from './data/topics.json';
import { romanizeTelugu, normalizeRomanQuery } from './romanize.js';

const app = document.querySelector('#app');
const PAGE_IMG = (page) =>
  \`/@fs/C:/Users/gayat/Downloads/bhajanamala_pages/mupdf-page-\${page}.png\`;

let query = '';
let listening = false;
let keepListening = false;
let recognition = null;
let view = 'topics';
let activeTopicPage = null;
let activeSongId = null;
let viewPage = null;

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

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
    .replace(/[\\u200c\\u200d]/g, '')
    .replace(/[|॥।.,!?"'\`[\\](){}-]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function isNoiseLine(line) {
  const t = normalize(line);
  if (!t) return true;
  if (/^\\d{1,3}$/.test(t)) return true;
  if (/\\d{1,2}-\\d{1,2}-\\d{2,4}/.test(t)) return true;
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
    .split(/\\r?\\n/)
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
    line = line.replace(/^[|\\[\\]]+\\s*/u, '').trim();
    if (!line || isNoiseLine(line) || looksLikeTopicHeading(line)) continue;
    if (/^\\u0c2a\\u0c3e\\u0c1f\\s*\\d+$/.test(normalize(line))) continue;
    if (line.length < 4) continue;
    return line;
  }
  if (song.songNo != null) return '${te.song} ' + song.songNo;
  return '${te.pageWord} ' + song.page;
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
  const blob = [
    title,
    song.phrase3,
    song.phrase4,
    song.opening,
    song.lyrics,
    topic?.topic,
    song.section,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    ...song,
    displayTitle: title,
    topic: song.section || topic?.topic || '',
    topicStart: song.topicPage || topic?.start || 1,
    topicIndex: topic?.index || 0,
    _telugu: normalize(blob),
    _roman: romanizeTelugu(blob),
  };
});

const topicCounters = new Map();
for (const song of songIndex) {
  const n = (topicCounters.get(song.topicStart) || 0) + 1;
  topicCounters.set(song.topicStart, n);
  song.indexInTopic = n;
}

function matches(song, q) {
  if (!q) return true;
  if (song._telugu.includes(q)) return true;
  const rq = normalizeRomanQuery(q);
  if (rq && song._roman.includes(rq)) return true;
  return q.split(' ').filter(Boolean).some((w) => {
    if (song._telugu.includes(w)) return true;
    const rw = normalizeRomanQuery(w);
    return rw && song._roman.includes(rw);
  });
}

function songsForTopic(topicStart) {
  return songIndex.filter((s) => s.topicStart === topicStart);
}

function searchResults() {
  const q = normalize(query);
  let list = songIndex;
  if (view === 'songs' && activeTopicPage != null) {
    list = songsForTopic(activeTopicPage);
  }
  if (!q) return list;
  return list.filter((s) => matches(s, q));
}

function openTopic(startPage) {
  activeTopicPage = startPage;
  query = '';
  view = 'songs';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSong(id) {
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
  }
  render();
}

function ensureRecognition() {
  if (!SpeechRecognition || recognition) return recognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'te-IN';
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.onstart = () => {
    listening = true;
    render();
  };
  recognition.onresult = (event) => {
    let text = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
    }
    query = text.trim();
    if (view !== 'song') render();
  };
  recognition.onerror = () => {
    listening = false;
    keepListening = false;
    render();
  };
  recognition.onend = () => {
    listening = false;
    if (keepListening) {
      try {
        recognition.start();
        return;
      } catch {
        setTimeout(() => {
          if (!keepListening) return;
          try {
            recognition.start();
          } catch {
            keepListening = false;
            render();
          }
        }, 200);
        return;
      }
    }
    render();
  };
  return recognition;
}

function toggleVoice() {
  if (!SpeechRecognition) return;
  const rec = ensureRecognition();
  if (keepListening || listening) {
    keepListening = false;
    try {
      rec.stop();
    } catch {}
    listening = false;
    render();
    return;
  }
  keepListening = true;
  try {
    rec.start();
  } catch {}
}

function renderTopics() {
  const q = normalize(query);
  const filteredTopics = topics.filter((t) => {
    if (!q) return true;
    const name = normalize(t.topic);
    const roman = romanizeTelugu(t.topic);
    if (name.includes(q) || roman.includes(normalizeRomanQuery(q))) return true;
    return songsForTopic(t.start).some((s) => matches(s, q));
  });
  return \`
    <div class="shell">
      <h1 class="brand">${te.brand}</h1>
      <p class="subtitle">${te.topicsLabel}</p>
      <div class="search-row">
        <input id="q" class="search" type="search" placeholder="${te.searchTopic}" value="\${esc(query)}" autocomplete="off" />
        <button type="button" id="voice-btn" class="voice-btn \${listening ? 'listening' : ''}">\${listening ? 'Stop' : 'Voice'}</button>
      </div>
      <p class="meta">\${filteredTopics.length} / \${topics.length} topics</p>
      <div class="list">
        \${filteredTopics
          .map((t) => {
            const count = songsForTopic(t.start).length;
            return \`
              <button type="button" class="card topic-link" data-start="\${t.start}">
                <span class="topic-index">\${t.index}.</span>
                <span class="topic-body">
                  <span class="topic-name">\${esc(t.topic)}</span>
                  <span class="topic-meta">\${count} songs · p.\${t.start}–\${t.end}</span>
                </span>
              </button>\`;
          })
          .join('')}
      </div>
    </div>
  \`;
}

function renderSongs() {
  const topic = topics.find((t) => t.start === activeTopicPage);
  const songs = searchResults();
  const heading = topic?.topic || '${te.songs}';
  return \`
    <div class="shell">
      <div class="toolbar">
        <button type="button" class="back-btn" id="back-btn">← Topics</button>
      </div>
      <h1 class="brand small">\${esc(heading)}</h1>
      <div class="search-row">
        <input id="q" class="search" type="search" placeholder="${te.searchIn}" value="\${esc(query)}" autocomplete="off" />
        <button type="button" id="voice-btn" class="voice-btn \${listening ? 'listening' : ''}">\${listening ? 'Stop' : 'Voice'}</button>
      </div>
      <p class="meta">\${songs.length} songs</p>
      \${
        songs.length
          ? \`<div class="list">
              \${songs
                .map(
                  (song) => \`
                <button type="button" class="card song-link" data-id="\${song.id}">
                  <span class="song-no">\${song.indexInTopic}.</span>
                  <span class="song-body">
                    <span class="song-title">\${esc(song.displayTitle)}</span>
                    <span class="song-meta">p.\${song.page}\${
                      song.songNo != null ? \` · #\${song.songNo}\` : ''
                    }</span>
                  </span>
                </button>\`
                )
                .join('')}
            </div>\`
          : \`<p class="empty">No songs found</p>\`
      }
    </div>
  \`;
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
  return \`
    <div class="shell song-shell">
      <div class="song-toolbar">
        <button type="button" class="back-btn" id="back-btn">← Back</button>
        <span class="page-label">\${esc(topic?.topic || '')} · p.\${page}</span>
        <div class="page-nav">
          <button type="button" class="nav-btn" id="prev-page" \${
            prevPage ? '' : 'disabled'
          }>Prev</button>
          <button type="button" class="nav-btn" id="next-page" \${
            nextPage ? '' : 'disabled'
          }>Next</button>
        </div>
      </div>
      <img class="pdf-page" src="\${PAGE_IMG(page)}" alt="page \${page}" />
    </div>
  \`;
}

function bind() {
  app.querySelector('#voice-btn')?.addEventListener('click', toggleVoice);
  app.querySelector('#back-btn')?.addEventListener('click', back);
  const input = app.querySelector('#q');
  input?.addEventListener('input', (e) => {
    query = e.target.value;
    const pos = e.target.selectionStart;
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
`;

fs.writeFileSync(
  require('path').join(__dirname, '../src/main.js'),
  src,
  'utf8'
);
console.log('wrote src/main.js');
