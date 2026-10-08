export const DEFAULT_CATEGORY = 'bible_characters';
export const CATEGORY = DEFAULT_CATEGORY;
export const QUESTION_COUNT = 10;
export const SECONDS_PER_QUESTION = 20;
export const DEFAULT_QUESTION_TIMEOUT = 20;
export const QUESTION_TIMEOUT_OPTIONS = [10, 15, 20, 30, 45];
export const BIBLE_LINK = reference =>
  `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference.replace(/–/g, '-'))}&version=NIRV`;

export const TRIVIA_CATEGORIES = {
  bible_characters: { label: 'Bible Characters', icon: '✨' },
  bible_stories: { label: 'Bible Stories', icon: '📖' },
  jesus: { label: 'Jesus', icon: '✝️' },
  miracles: { label: 'Miracles', icon: '✨' },
  memory_verses: { label: 'Memory Verses', icon: '🕊️' },
  bible_animals: { label: 'Bible Animals', icon: '🐑' },
  ten_commandments: { label: 'Ten Commandments', icon: '📜' },
  fruits_of_the_spirit: { label: 'Fruits of the Spirit', icon: '🌿' },
  prophecy: { label: 'Prophecy', icon: '🔮' },
  old_testament: { label: 'Old Testament', icon: '🗺️' },
  new_testament: { label: 'New Testament', icon: '📜' },
};

export const LEVELS = {
  easy: { label: 'Easy', age: 'Ages 4-6', detail: 'Simple, well-known questions', mark: '01' },
  medium: { label: 'Medium', age: 'Ages 7-9', detail: 'More story detail', mark: '02' },
  hard: { label: 'Hard', age: 'Ages 10+', detail: 'Deeper Bible knowledge', mark: '03' },
};

export const MODULE_LEVEL_COUNT = 10;
export const PASS_PERCENT_REQUIRED = 85;
export const COURSE_MODULES = {
  easy: { label: 'Easy module', rewardName: 'Crown of Courage', finishLabel: 'Easy crown unlocked' },
  medium: { label: 'Medium module', rewardName: 'Crown of Wisdom', finishLabel: 'Medium crown unlocked' },
  hard: { label: 'Hard module', rewardName: 'Crown of Faith', finishLabel: 'Category certificate earned' },
};

export function normalizeDifficulty(value) {
  const cleaned = String(value || '').trim().toLowerCase();
  if (!cleaned) return 'easy';
  if (cleaned === 'challenge') return 'hard';
  if (cleaned === 'hard' || cleaned === 'easy' || cleaned === 'medium') return cleaned;
  return 'easy';
}

export const HOST_MESSAGES = {
  correct: ['Amazing! You got it!', 'Wow, great job!', 'That is right!'],
  wrong: ['Good try! Let’s learn together.', 'Nice effort. Here’s what the Bible says.', 'Almost! Let’s learn something new.'],
  streak: ['You’re on fire!', 'What a streak!', 'Keep it going!'],
  last: 'This is the last one. Give it your best!',
};

export const AVATARS = { lamb: '🐑', lion: '🦁', dove: '🕊️', ark: '🚢', star: '⭐', crown: '👑' };
export const NICKNAMES = [
  'Brave Lion', 'Happy Lamb', 'Kind Dove', 'Bright Star', 'Faithful Friend',
  'Joyful Explorer', 'Little Shepherd', 'Courageous Heart', 'Wise Owl', 'Gentle Giant',
];

export const pick = values => values[Math.floor(Math.random() * values.length)];