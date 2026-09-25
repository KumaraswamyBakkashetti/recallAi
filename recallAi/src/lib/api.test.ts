import assert from 'node:assert/strict';
import test from 'node:test';
import { ApplicationError, generateStudyPlan } from './api';

test('known API errors retain safe application codes and messages', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, code] of [
      [400, 'EMPTY_INPUT'],
      [429, 'RATE_LIMITED'],
      [502, 'INVALID_AI_OUTPUT'],
      [504, 'TIMEOUT'],
      [500, 'SERVER_ERROR'],
    ] as const) {
      globalThis.fetch = async () => new Response(JSON.stringify({ error: { code, message: 'Safe message' } }), { status });
      await assert.rejects(generateStudyPlan('topic'), (error: unknown) => {
        assert.ok(error instanceof ApplicationError);
        assert.equal(error.code, code);
        assert.equal(error.message, 'Safe message');
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('HTTP status has a useful fallback when the error body is unreadable', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, code] of [
      [400, 'INVALID_INPUT'],
      [413, 'INPUT_TOO_LONG'],
      [429, 'RATE_LIMITED'],
      [502, 'UPSTREAM_ERROR'],
      [504, 'TIMEOUT'],
      [500, 'SERVER_ERROR'],
    ] as const) {
      globalThis.fetch = async () => new Response('not JSON', { status });
      await assert.rejects(generateStudyPlan('topic'), (error: unknown) => {
        assert.ok(error instanceof ApplicationError);
        assert.equal(error.code, code);
        assert.ok(error.message.length > 0);
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('successful HTTP response still requires a valid StudyPlan', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ studyPlan: { title: 'Incomplete' } }), { status: 200 });
    await assert.rejects(generateStudyPlan('topic'), (error: unknown) => {
      assert.ok(error instanceof ApplicationError);
      assert.equal(error.code, 'SERVER_ERROR');
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
