import { useCallback, useEffect, useReducer, useRef } from 'react';
import { SECONDS_PER_QUESTION } from '../config/constants';
import { startGame, submitAnswer } from '../services/triviaService';

function buildInitialState(timeLimit = SECONDS_PER_QUESTION) {
  return { phase: 'loading', sid: null, qs: [], i: 0, score: 0, streak: 0, left: timeLimit, chosen: null, feedback: null, refs: [], error: null };
}

function reducer(state, action) {
  switch (action.type) {
    case 'loaded': return { ...state, phase: 'playing', sid: action.sid, qs: action.qs, left: action.timeLimit ?? state.left };
    case 'error': return { ...state, phase: 'error', error: action.message };
    case 'tick': return { ...state, left: Math.max(0, Number((state.left - 0.1).toFixed(1))) };
    case 'locked': return { ...state, phase: 'answering', chosen: action.key };
    case 'feedback': return { ...state, phase: 'feedback', score: state.score + action.result.points, streak: action.result.streak, feedback: action.result, refs: [...state.refs, { ref: action.result.bible_reference, character: action.character }] };
    case 'next': return { ...state, phase: 'playing', i: state.i + 1, left: action.timeLimit ?? state.left, chosen: null, feedback: null };
    default: return state;
  }
}

export default function useGame(level, timerOn, category, timeLimit = SECONDS_PER_QUESTION) {
  const [state, dispatch] = useReducer(reducer, buildInitialState(timeLimit));
  const stateRef = useRef(state);
  const locked = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    let active = true;
    locked.current = false;
    startGame(level, timerOn, category)
      .then(result => {
        if (!active) return;
        if (result.error) dispatch({ type: 'error', message: 'This category does not have enough questions for this level yet. Try another category or level.' });
        else dispatch({ type: 'loaded', sid: result.session_id, qs: result.questions || [], timeLimit });
      })
      .catch(error => { if (active) dispatch({ type: 'error', message: error.message }); });
    return () => { active = false; };
  }, [level, timerOn, category, timeLimit]);

  const answer = useCallback(async key => {
    if (locked.current) return;
    locked.current = true;
    const current = stateRef.current;
    const question = current.qs[current.i];
    dispatch({ type: 'locked', key });
    try {
      const result = await submitAnswer(current.sid, question.id, key, current.left);
      if (result.error) throw new Error('This game could not be saved. Please start again.');
      dispatch({ type: 'feedback', result, character: question.character });
    } catch (error) {
      dispatch({ type: 'error', message: error.message });
    }
  }, []);

  useEffect(() => {
    if (!timerOn || state.phase !== 'playing') return undefined;
    const timer = setInterval(() => dispatch({ type: 'tick' }), 100);
    return () => clearInterval(timer);
  }, [timerOn, state.phase, state.i]);

  useEffect(() => {
    if (timerOn && state.phase === 'playing' && state.left <= 0) void answer(null);
  }, [state.left, state.phase, timerOn, answer]);

  const next = useCallback(() => {
    locked.current = false;
    dispatch({ type: 'next', timeLimit });
  }, [timeLimit]);

  return { state, answer, next };
}