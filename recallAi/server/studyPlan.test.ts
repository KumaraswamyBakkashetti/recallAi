import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignStudyPlanIds,
  studyPlanContentSchema,
  studyPlanSchema,
  validateStudySemantics,
} from '../shared/studyPlan.ts';

const validContent = {
  title: 'Photosynthesis',
  summary: 'Plants convert light into chemical energy.',
  concepts: ['Chlorophyll absorbs light', 'Carbon dioxide is used', 'Glucose stores energy'],
  flashcards: [
    { question: 'What absorbs light?', answer: 'Chlorophyll' },
    { question: 'What gas is used?', answer: 'Carbon dioxide' },
    { question: 'What stores energy?', answer: 'Glucose' },
  ],
  quiz: [
    { question: 'What absorbs light energy?', options: ['Water', 'Oxygen', 'Chlorophyll', 'Glucose'], correctOptionIndex: 2, explanation: 'Correct answer: Chlorophyll. It absorbs light.' },
    { question: 'What gas is a reactant?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctOptionIndex: 2, explanation: 'Correct answer: Carbon dioxide. Plants take it in.' },
    { question: 'Which product stores energy?', options: ['Glucose', 'Water', 'Oxygen', 'Carbon dioxide'], correctOptionIndex: 0, explanation: 'Correct answer: Glucose. It stores chemical energy.' },
  ],
};

test('validates content, trims it, and assigns stable IDs', () => {
  const parsed = studyPlanContentSchema.parse({ ...validContent, title: '  Photosynthesis  ' });
  assert.equal(parsed.title, 'Photosynthesis');
  assert.equal(validateStudySemantics(parsed), true);
  const plan = assignStudyPlanIds(parsed);
  assert.deepEqual(plan.flashcards.map((card) => card.id), ['fc-1', 'fc-2', 'fc-3']);
  assert.deepEqual(plan.quiz.map((question) => question.id), ['q-1', 'q-2', 'q-3']);
  assert.equal(studyPlanSchema.safeParse(plan).success, true);
});

test('rejects wrong shapes and invalid answer indexes', () => {
  assert.equal(studyPlanContentSchema.safeParse({ ...validContent, quiz: [] }).success, false);
  assert.equal(studyPlanContentSchema.safeParse({ ...validContent, quiz: validContent.quiz.map((q) => ({ ...q, correctOptionIndex: 4 })) }).success, false);
  assert.equal(studyPlanContentSchema.safeParse({ ...validContent, concepts: ['Same', ' same ', 'Other'] }).success, false);
  assert.equal(studyPlanContentSchema.safeParse({ ...validContent, flashcards: [{ ...validContent.flashcards[0], id: 'model-id' }, ...validContent.flashcards.slice(1)] }).success, false);
});

test('rejects repeated question content', () => {
  const content = studyPlanContentSchema.parse({
    ...validContent,
    flashcards: [validContent.flashcards[0], validContent.flashcards[0], validContent.flashcards[2]],
  });
  assert.equal(validateStudySemantics(content), false);
});

test('rejects an explanation that disagrees with the indexed answer', () => {
  const content = studyPlanContentSchema.parse({
    ...validContent,
    quiz: [{ ...validContent.quiz[0], explanation: 'Correct answer: Water. It absorbs light.' }, ...validContent.quiz.slice(1)],
  });
  assert.equal(validateStudySemantics(content), false);
});
