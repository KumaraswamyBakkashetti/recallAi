import assert from 'node:assert/strict';
import test from 'node:test';
import { assignStudyPlanIds, studyPlanContentSchema } from '../../shared/studyPlan';
import {
  activeCardIds,
  activeCardRatings,
  activeQuizAnswers,
  activeQuizIds,
  cardCounts,
  createInitialSession,
  quizResults,
  studySessionReducer,
} from './studySession';

const plan = assignStudyPlanIds(studyPlanContentSchema.parse({
  title: 'Trees',
  summary: 'A small set about trees.',
  concepts: ['Roots', 'Children', 'Traversal'],
  flashcards: [
    { question: 'What is a root?', answer: 'The top node.' },
    { question: 'What is a child?', answer: 'A node below another.' },
    { question: 'What is traversal?', answer: 'Visiting nodes.' },
  ],
  quiz: [
    { question: 'Which node is on top?', options: ['Leaf', 'Root', 'Child', 'Edge'], correctOptionIndex: 1, explanation: 'Correct answer: Root. It is on top.' },
    { question: 'Which is below a parent?', options: ['Root', 'Edge', 'Child', 'Forest'], correctOptionIndex: 2, explanation: 'Correct answer: Child. It is below a parent.' },
    { question: 'What visits nodes?', options: ['Traversal', 'Insertion', 'Sorting', 'Deletion'], correctOptionIndex: 0, explanation: 'Correct answer: Traversal. It visits nodes.' },
  ],
}));

test('flashcard reveal, rating, navigation, and progress use separate state', () => {
  let state = createInitialSession();
  const originalPlan = JSON.stringify(plan);
  state = studySessionReducer(state, { type: 'CARD_RATE', id: 'fc-1', rating: 'known' });
  assert.deepEqual(state.flashcards.ratingsById, {});
  state = studySessionReducer(state, { type: 'CARD_REVEAL' });
  assert.equal(state.flashcards.revealed, true);
  state = studySessionReducer(state, { type: 'CARD_RATE', id: 'fc-1', rating: 'known' });
  state = studySessionReducer(state, { type: 'CARD_MOVE', index: 1, total: 3 });
  assert.equal(state.flashcards.revealed, false);
  state = studySessionReducer(state, { type: 'CARD_REVEAL' });
  state = studySessionReducer(state, { type: 'CARD_RATE', id: 'fc-2', rating: 'missed' });
  state = studySessionReducer(state, { type: 'CARD_MOVE', index: 0, total: 3 });
  assert.equal(activeCardRatings(state)['fc-1'], 'known');
  assert.equal(activeCardRatings(state)['fc-2'], 'missed');
  assert.deepEqual(cardCounts(activeCardIds(plan, state), activeCardRatings(state)), { known: 1, missed: 1, reviewed: 2, unreviewed: 1 });
  assert.equal(JSON.stringify(plan), originalPlan);
});

test('flashcard retest uses only missed IDs and has independent ratings', () => {
  let state = createInitialSession();
  state = studySessionReducer(state, { type: 'CARD_REVEAL' });
  state = studySessionReducer(state, { type: 'CARD_RATE', id: 'fc-1', rating: 'known' });
  state = studySessionReducer(state, { type: 'CARD_MOVE', index: 1, total: 3 });
  state = studySessionReducer(state, { type: 'CARD_REVEAL' });
  state = studySessionReducer(state, { type: 'CARD_RATE', id: 'fc-2', rating: 'missed' });
  state = studySessionReducer(state, { type: 'CARD_MOVE', index: 2, total: 3 });
  state = studySessionReducer(state, { type: 'CARD_COMPLETE', total: 3 });
  assert.equal(state.flashcards.completed, true);
  const missedIds = activeCardIds(plan, state).filter((id) => activeCardRatings(state)[id] === 'missed');
  state = studySessionReducer(state, { type: 'CARD_RETEST', ids: missedIds });
  assert.deepEqual(activeCardIds(plan, state), ['fc-2']);
  assert.equal(state.flashcards.revealed, false);
  state = studySessionReducer(state, { type: 'CARD_REVEAL' });
  state = studySessionReducer(state, { type: 'CARD_RATE', id: 'fc-2', rating: 'known' });
  state = studySessionReducer(state, { type: 'CARD_COMPLETE', total: 1 });
  assert.deepEqual(cardCounts(activeCardIds(plan, state), activeCardRatings(state)), { known: 1, missed: 0, reviewed: 1, unreviewed: 0 });
  assert.equal(state.flashcards.ratingsById['fc-2'], 'missed');
});

test('quiz selection locks after submission and score is derived', () => {
  let state = createInitialSession();
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-1' });
  assert.deepEqual(activeQuizAnswers(state), {});
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-1', optionIndex: 1 });
  assert.equal(state.quiz.selectedOptionIndex, 1);
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-1' });
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-1', optionIndex: 0 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-1' });
  assert.equal(activeQuizAnswers(state)['q-1'], 1);
  assert.equal(Object.keys(activeQuizAnswers(state)).length, 1);
  state = studySessionReducer(state, { type: 'QUIZ_NEXT', id: 'q-1', total: 3 });
  assert.equal(state.quiz.selectedOptionIndex, null);
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-2', optionIndex: 0 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-2' });
  assert.deepEqual(quizResults(plan, activeQuizIds(plan, state), activeQuizAnswers(state)), {
    total: 3, correct: 1, incorrect: 1, percentage: 33, wrongIds: ['q-2'],
  });
});

test('wrong-answer retest has independent score and reset clears old state', () => {
  let state = createInitialSession();
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-1', optionIndex: 0 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-1' });
  state = studySessionReducer(state, { type: 'QUIZ_NEXT', id: 'q-1', total: 3 });
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-2', optionIndex: 2 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-2' });
  state = studySessionReducer(state, { type: 'QUIZ_NEXT', id: 'q-2', total: 3 });
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-3', optionIndex: 0 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-3' });
  state = studySessionReducer(state, { type: 'QUIZ_NEXT', id: 'q-3', total: 3 });
  assert.equal(state.quiz.completed, true);
  const wrongIds = quizResults(plan, activeQuizIds(plan, state), activeQuizAnswers(state)).wrongIds;
  assert.deepEqual(wrongIds, ['q-1']);
  state = studySessionReducer(state, { type: 'QUIZ_RETEST', ids: wrongIds });
  assert.deepEqual(activeQuizIds(plan, state), ['q-1']);
  assert.deepEqual(activeQuizAnswers(state), {});
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-1', optionIndex: 1 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-1' });
  state = studySessionReducer(state, { type: 'QUIZ_NEXT', id: 'q-1', total: 1 });
  assert.deepEqual(quizResults(plan, activeQuizIds(plan, state), activeQuizAnswers(state)), {
    total: 1, correct: 1, incorrect: 0, percentage: 100, wrongIds: [],
  });
  state = studySessionReducer(state, { type: 'RESET' });
  assert.deepEqual(state, createInitialSession());
});

test('overview navigation preserves progress and an empty retest does nothing', () => {
  let state = createInitialSession();
  state = studySessionReducer(state, { type: 'OPEN', mode: 'flashcards' });
  state = studySessionReducer(state, { type: 'CARD_REVEAL' });
  state = studySessionReducer(state, { type: 'CARD_RATE', id: 'fc-1', rating: 'known' });
  state = studySessionReducer(state, { type: 'OPEN', mode: 'overview' });
  state = studySessionReducer(state, { type: 'OPEN', mode: 'flashcards' });
  assert.equal(state.flashcards.ratingsById['fc-1'], 'known');
  const unchanged = studySessionReducer(state, { type: 'CARD_RETEST', ids: ['fc-1'] });
  assert.equal(unchanged, state);
  assert.equal(studySessionReducer(state, { type: 'QUIZ_RETEST', ids: [] }), state);
});

test('flashcard retest returns to original completion without losing original ratings', () => {
  let state = createInitialSession();
  state = studySessionReducer(state, { type: 'CARD_REVEAL' });
  state = studySessionReducer(state, { type: 'CARD_RATE', id: 'fc-1', rating: 'missed' });
  state = studySessionReducer(state, { type: 'CARD_MOVE', index: 2, total: 3 });
  state = studySessionReducer(state, { type: 'CARD_COMPLETE', total: 3 });
  state = studySessionReducer(state, { type: 'CARD_RETEST', ids: ['fc-1', 'fc-2'] });
  assert.deepEqual(activeCardIds(plan, state), ['fc-1']);
  state = studySessionReducer(state, { type: 'CARD_REVEAL' });
  state = studySessionReducer(state, { type: 'CARD_RATE', id: 'fc-1', rating: 'known' });
  state = studySessionReducer(state, { type: 'CARD_COMPLETE', total: 1 });
  state = studySessionReducer(state, { type: 'CARD_RETURN_TO_ALL' });
  assert.equal(state.flashcards.round, 'all');
  assert.equal(state.flashcards.completed, true);
  assert.equal(state.flashcards.ratingsById['fc-1'], 'missed');
  assert.deepEqual(activeCardIds(plan, state), ['fc-1', 'fc-2', 'fc-3']);
});

test('quiz retest returns to full results and keeps the original score', () => {
  let state = createInitialSession();
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-1', optionIndex: 0 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-1' });
  state = studySessionReducer(state, { type: 'QUIZ_NEXT', id: 'q-1', total: 3 });
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-2', optionIndex: 2 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-2' });
  state = studySessionReducer(state, { type: 'QUIZ_NEXT', id: 'q-2', total: 3 });
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-3', optionIndex: 0 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-3' });
  state = studySessionReducer(state, { type: 'QUIZ_NEXT', id: 'q-3', total: 3 });
  const original = quizResults(plan, activeQuizIds(plan, state), state.quiz.answersById);
  state = studySessionReducer(state, { type: 'QUIZ_RETEST', ids: original.wrongIds });
  state = studySessionReducer(state, { type: 'QUIZ_SELECT', id: 'q-1', optionIndex: 1 });
  state = studySessionReducer(state, { type: 'QUIZ_SUBMIT', id: 'q-1' });
  state = studySessionReducer(state, { type: 'QUIZ_NEXT', id: 'q-1', total: 1 });
  state = studySessionReducer(state, { type: 'QUIZ_RETURN_TO_ALL' });
  assert.equal(state.quiz.round, 'all');
  assert.equal(state.quiz.completed, true);
  assert.equal(state.quiz.answersById['q-1'], 0);
  assert.deepEqual(quizResults(plan, activeQuizIds(plan, state), state.quiz.answersById), original);
});
