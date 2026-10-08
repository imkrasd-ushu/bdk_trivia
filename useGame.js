import { useCallback, useEffect, useReducer, useRef } from 'react';
import { startGame, submitAnswer } from '../services/triviaService';
import { SECONDS_PER_QUESTION } from '../config/constants';

const init = { phase: 'loading', sid: null, qs: [], i: 0, score: 0, streak: 0, left: SECONDS_PER_QUESTION, chosen: null, feedback: null, refs: [], error: null };

function reducer(s, a) {
  switch (a.type) {
    case 'loaded': return { ...init, phase: 'playing', sid: a.sid, qs: a.qs };
    case 'error': return { ...s, phase: 'error', error: a.msg };
    case 'tick': return { ...s, left: Math.max(0, +(s.left - 0.1).toFixed(1)) };
    case 'locked': return { ...s, phase: 'answering', chosen: a.key };
    case 'feedback': return { ...s, phase: 'feedback', score: s.score + a.r.points, streak: a.r.streak, feedback: a.r, refs: [...s.refs, { ref: a.r.bible_reference, character: a.character }] };
    case 'next': return { ...s, phase: 'playing', i: s.i + 1, left: SECONDS_PER_QUESTION, chosen: null, feedback: null };
    default: return s;
  }
}

/** Game state machine. All scoring happens on the server; this hook only sequences the UI. */
export default function useGame(level, timerOn) {
  const [s, dispatch] = useReducer(reducer, init);
  const ref = useRef(s); ref.current = s;
  const locked = useRef(false);

  useEffect(() => {
    startGame(level, timerOn)
      .then(r => r.error ? dispatch({ type: 'error', msg: 'This level needs a few more questions. Try another level.' }) : dispatch({ type: 'loaded', sid: r.session_id, qs: r.questions }))
      .catch(e => dispatch({ type: 'error', msg: e.message }));
  }, [level, timerOn]);

  const answer = useCallback(async key => {
    if (locked.current) return; // one result per question: double taps and a late timer are ignored
    locked.current = true;
    const cur = ref.current, q = cur.qs[cur.i];
    dispatch({ type: 'locked', key });
    try {
      const r = await submitAnswer(cur.sid, q.id, key, cur.left);
      if (r.error) throw new Error('This game could not be saved. Please start again.');
      dispatch({ type: 'feedback', r, character: q.character });
    } catch (e) { dispatch({ type: 'error', msg: e.message }); }
  }, []);

  useEffect(() => {
    if (!timerOn || s.phase !== 'playing') return;
    const t = setInterval(() => dispatch({ type: 'tick' }), 100);
    return () => clearInterval(t);
  }, [timerOn, s.phase, s.i]);
  useEffect(() => { if (timerOn && s.phase === 'playing' && s.left <= 0) answer(null); }, [s.left, s.phase, timerOn, answer]);

  const next = useCallback(() => { locked.current = false; dispatch({ type: 'next' }); }, []);
  return { state: s, answer, next };
}
