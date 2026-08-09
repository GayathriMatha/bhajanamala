/**
 * Continuous Telugu voice search (Chrome/Edge).
 * Stays on until the user taps Stop; auto-restarts when Chrome ends the session.
 * Falls back te-IN → en-IN → en-US only when a session ends with no words.
 */

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const LANGS = ['te-IN', 'en-IN', 'en-US'];

function bestAlt(result) {
  const n = typeof result.length === 'number' ? result.length : 1;
  for (let j = 0; j < n; j++) {
    const alt = result.item ? result.item(j) : result[j];
    const piece = alt && alt.transcript != null ? String(alt.transcript) : '';
    if (piece.trim()) return piece;
  }
  return '';
}

/** Full session transcript: all finals + current interim. */
function readSessionTranscript(event) {
  let finals = '';
  let interim = '';
  for (let i = 0; i < event.results.length; i++) {
    const result = event.results.item
      ? event.results.item(i)
      : event.results[i];
    if (!result) continue;
    const piece = bestAlt(result);
    if (!piece) continue;
    if (result.isFinal) finals += piece + ' ';
    else interim += piece;
  }
  const final = finals.trim();
  const interimText = interim.trim();
  return {
    final,
    interim: interimText,
    display: (final + (interimText ? ' ' + interimText : '')).trim(),
  };
}

export function createVoice({ onText, onInterim, onEnd, onError, onStatus }) {
  if (!SpeechRecognition) {
    return {
      supported: false,
      get listening() {
        return false;
      },
      start() {
        onError?.('Voice needs Chrome or Edge');
      },
      stop() {},
    };
  }

  let rec = null;
  let active = false;
  let gotText = false;
  let langIndex = 0;
  let stoppedByUser = false;
  let fatalError = false;
  let restartTimer = null;

  function clearRestart() {
    if (restartTimer != null) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function kill() {
    clearRestart();
    if (!rec) return;
    const old = rec;
    rec = null;
    try {
      old.onstart = null;
      old.onresult = null;
      old.onerror = null;
      old.onend = null;
      old.onaudiostart = null;
      old.onsoundstart = null;
      old.onspeechstart = null;
      old.onspeechend = null;
      old.abort();
    } catch {
      try {
        old.stop();
      } catch {
        /* ignore */
      }
    }
  }

  function scheduleRestart(delay = 220) {
    clearRestart();
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (stoppedByUser || fatalError) return;
      begin();
    }, delay);
  }

  function make() {
    const r = new SpeechRecognition();
    const lang = LANGS[langIndex] || 'te-IN';
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 3;

    r.onstart = () => {
      active = true;
      console.log('[voice] onstart', r.lang);
      onStatus?.(
        lang.startsWith('te')
          ? 'వింటున్నాను… తెలుగులో చెప్పండి'
          : 'Listening… say rama / govinda'
      );
    };

    r.onresult = (event) => {
      const { final, display } = readSessionTranscript(event);
      if (!display) return;

      console.log('[voice] onresult', {
        final: JSON.stringify(final),
        display: JSON.stringify(display),
      });

      gotText = true;
      // Live + search updates — never stop here; user taps Stop
      onInterim?.(display);
      if (final) onText?.(display);
    };

    r.onerror = (event) => {
      const err = event.error || '';
      console.error('[voice] onerror', err);
      if (err === 'aborted') return;
      // Silence / no-speech: Chrome will fire onend — we restart there
      if (err === 'no-speech' || err === 'audio-capture') return;
      if (err === 'not-allowed') {
        fatalError = true;
        active = false;
        onError?.('మైక్ allow చేయండి');
        return;
      }
      if (err === 'network') {
        fatalError = true;
        active = false;
        onError?.('Internet కావాలి (Chrome voice)');
        return;
      }
      onStatus?.('Error: ' + err);
    };

    r.onend = () => {
      console.log('[voice] onend gotText=', gotText, 'lang=', r.lang);
      active = false;
      if (stoppedByUser || fatalError) {
        onEnd?.();
        return;
      }
      // Keep listening: Chrome often ends continuous sessions on its own
      if (gotText) {
        scheduleRestart(200);
        return;
      }
      // Empty session → try next language once
      if (langIndex < LANGS.length - 1) {
        langIndex += 1;
        console.log('[voice] retry with', LANGS[langIndex]);
        onStatus?.('Trying ' + LANGS[langIndex] + '…');
        scheduleRestart(250);
        return;
      }
      onStatus?.('అక్షరాలు రాలేదు — టైప్ చేయండి లేదా మళ్లీ Voice');
      onEnd?.();
    };

    return r;
  }

  function begin() {
    kill();
    rec = make();
    active = true;
    try {
      rec.start();
      console.log('[voice] start', rec.lang);
    } catch (e) {
      console.error('[voice] start failed', e);
      scheduleRestart(350);
    }
  }

  return {
    supported: true,
    get listening() {
      return active || (!stoppedByUser && !fatalError && restartTimer != null);
    },
    start() {
      stoppedByUser = false;
      gotText = false;
      fatalError = false;
      langIndex = 0;
      begin();
    },
    stop() {
      stoppedByUser = true;
      active = false;
      kill();
      onEnd?.();
    },
  };
}
