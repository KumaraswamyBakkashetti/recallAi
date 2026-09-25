import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudyPlan, GenerationFailure } from './generate.ts';
import { ProviderFailure } from './groq.ts';

const content = {
  title: 'Binary search trees',
  summary: 'A binary search tree orders values to support efficient search when balanced.',
  concepts: ['Left children are smaller', 'Right children are larger', 'Balance affects performance'],
  flashcards: [
    { question: 'What is the left-child rule?', answer: 'A left child is smaller than its parent.' },
    { question: 'What is the right-child rule?', answer: 'A right child is larger than its parent.' },
    { question: 'Why does balance matter?', answer: 'It limits tree height and search work.' },
  ],
  quiz: [
    { question: 'Where does a smaller value go?', options: ['Left subtree', 'Right subtree', 'Root only', 'Either side'], correctOptionIndex: 0, explanation: 'Correct answer: Left subtree. Smaller values go left.' },
    { question: 'What can make search slow?', options: ['Balance', 'Skew', 'Sorting', 'Recursion'], correctOptionIndex: 1, explanation: 'Correct answer: Skew. A skewed tree can have linear height.' },
    { question: 'Which traversal yields sorted values?', options: ['Preorder', 'Postorder', 'Inorder', 'Level order'], correctOptionIndex: 2, explanation: 'Correct answer: Inorder. It visits left, root, then right.' },
  ],
};

const modelResponse = async () => JSON.stringify(content);

function expectFailure(code: GenerationFailure['code'], status: number) {
  return (error: unknown) => {
    assert.ok(error instanceof GenerationFailure);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  };
}

test('valid model JSON becomes a normalized StudyPlan', async () => {
  const plan = await createStudyPlan('binary search trees', 'test-key', modelResponse);
  assert.equal(plan.title, content.title);
  assert.deepEqual(plan.flashcards.map((card) => card.id), ['fc-1', 'fc-2', 'fc-3']);
  assert.deepEqual(plan.quiz.map((question) => question.id), ['q-1', 'q-2', 'q-3']);
});

test('empty model response is controlled', async () => {
  await assert.rejects(createStudyPlan('topic', 'test-key', async () => ''), expectFailure('EMPTY_AI_RESPONSE', 502));
});

test('malformed JSON is controlled', async () => {
  await assert.rejects(createStudyPlan('topic', 'test-key', async () => '{ invalid json'), expectFailure('INVALID_AI_OUTPUT', 502));
});

test('wrong shape is controlled', async () => {
  await assert.rejects(createStudyPlan('topic', 'test-key', async () => JSON.stringify({ title: 'test', flashcards: 'not an array' })), expectFailure('INVALID_AI_OUTPUT', 502));
});

test('invalid quiz index is controlled', async () => {
  const invalid = { ...content, quiz: [{ ...content.quiz[0], correctOptionIndex: 10 }, ...content.quiz.slice(1)] };
  await assert.rejects(createStudyPlan('topic', 'test-key', async () => JSON.stringify(invalid)), expectFailure('INVALID_AI_OUTPUT', 502));
});

test('duplicate options are controlled', async () => {
  const invalid = { ...content, quiz: [{ ...content.quiz[0], options: ['A', 'A', 'B', 'C'] }, ...content.quiz.slice(1)] };
  await assert.rejects(createStudyPlan('topic', 'test-key', async () => JSON.stringify(invalid)), expectFailure('INVALID_AI_OUTPUT', 502));
});

test('provider failures are controlled', async () => {
  await assert.rejects(createStudyPlan('topic', 'test-key', async () => { throw new Error('provider details'); }), expectFailure('UPSTREAM_ERROR', 502));
});

test('rate limits are controlled', async () => {
  await assert.rejects(createStudyPlan('topic', 'test-key', async () => { throw new ProviderFailure('rate_limit', 429); }), expectFailure('RATE_LIMITED', 429));
});

test('provider timeouts are controlled', async () => {
  await assert.rejects(createStudyPlan('topic', 'test-key', async () => { throw new ProviderFailure('timeout'); }), expectFailure('TIMEOUT', 504));
});

test('deadline aborts a hung provider and returns a timeout', async () => {
  let signalWasAborted = false;
  const provider = async (_material: string, _key: string, signal: AbortSignal): Promise<string> =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        signalWasAborted = true;
        reject(new ProviderFailure('timeout'));
      });
    });
  await assert.rejects(createStudyPlan('topic', 'test-key', provider, 10), expectFailure('TIMEOUT', 504));
  assert.equal(signalWasAborted, true);
});
