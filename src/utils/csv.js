import { DEFAULT_CATEGORY, normalizeDifficulty } from '../config/constants';

export const CSV_COLUMNS = ['difficulty', 'character', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation', 'bible_reference', 'hint'];

export function parseCSV(input) {
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function validateQuestionRows(rows, category = DEFAULT_CATEGORY) {
  if (!rows.length) return { ready: [], errors: [{ row: 1, messages: ['The CSV has no header row.'] }] };
  const header = rows[0].map(value => value.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter(column => column !== 'hint' && !header.includes(column));
  if (missing.length) return { ready: [], errors: [{ row: 1, messages: [`Missing columns: ${missing.join(', ')}`] }] };

  const ready = [];
  const errors = [];
  rows.slice(1).forEach((values, index) => {
    const question = Object.fromEntries(header.map((key, column) => [key, (values[column] || '').trim()]));
    question.correct_option = (question.correct_option || '').toLowerCase();
    const messages = [];
    CSV_COLUMNS.filter(key => key !== 'hint').forEach(key => { if (!question[key]) messages.push(`${key} is empty`); });
    const normalizedDifficulty = normalizeDifficulty(question.difficulty);
    if (!['easy', 'medium', 'hard', 'challenge'].includes(question.difficulty.trim().toLowerCase())) messages.push('difficulty must be easy, medium, hard or challenge');
    if (!['a', 'b', 'c', 'd'].includes(question.correct_option)) messages.push('correct_option must be a, b, c or d');
    const options = ['option_a', 'option_b', 'option_c', 'option_d'].map(key => question[key]?.toLowerCase());
    if (new Set(options).size !== 4) messages.push('the four options must be different');
    if (question.bible_reference && !/\d/.test(question.bible_reference)) messages.push('bible_reference needs a chapter and verse');
    if (messages.length) errors.push({ row: index + 2, messages });
    else ready.push({
      category: category || DEFAULT_CATEGORY,
      difficulty: normalizedDifficulty,
      character: question.character,
      question: question.question,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_option: question.correct_option,
      explanation: question.explanation,
      bible_reference: question.bible_reference,
      hint: question.hint || null,
      is_published: false,
    });
  });
  return { ready, errors };
}