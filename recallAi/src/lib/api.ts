import { z } from 'zod';
import { studyPlanSchema, validateStudySemantics, type StudyPlan } from '../../shared/studyPlan';

const errorCodes = [
  'EMPTY_INPUT',
  'INVALID_INPUT',
  'INPUT_TOO_LONG',
  'EMPTY_AI_RESPONSE',
  'INVALID_AI_OUTPUT',
  'RATE_LIMITED',
  'UPSTREAM_ERROR',
  'TIMEOUT',
  'SERVER_ERROR',
] as const;

const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(errorCodes),
    message: z.string().min(1),
  }),
});

const successResponseSchema = z.object({ studyPlan: studyPlanSchema });

export class ApplicationError extends Error {
  constructor(public readonly code: (typeof errorCodes)[number], message: string) {
    super(message);
    this.name = 'ApplicationError';
  }
}

function fallbackError(status: number): ApplicationError {
  switch (status) {
    case 400:
      return new ApplicationError('INVALID_INPUT', 'Check your study material and try again.');
    case 413:
      return new ApplicationError('INPUT_TOO_LONG', 'Keep study material under 8,000 characters.');
    case 429:
      return new ApplicationError('RATE_LIMITED', 'The AI service is temporarily busy. Please try again shortly.');
    case 502:
      return new ApplicationError('UPSTREAM_ERROR', 'The study service is unavailable. Please try again.');
    case 504:
      return new ApplicationError('TIMEOUT', 'Generation timed out. Please try again.');
    default:
      return new ApplicationError('SERVER_ERROR', 'The study service could not complete the request.');
  }
}

export async function generateStudyPlan(material: string, signal?: AbortSignal): Promise<StudyPlan> {
  let response: Response;
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material }),
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApplicationError('UPSTREAM_ERROR', 'Could not connect to the study service. Please try again.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw fallbackError(response.status);
    throw new ApplicationError('SERVER_ERROR', 'The study service returned an unreadable response.');
  }

  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApplicationError(parsed.data.error.code, parsed.data.error.message);
    }
    throw fallbackError(response.status);
  }

  const parsed = successResponseSchema.safeParse(payload);
  if (!parsed.success || !validateStudySemantics(parsed.data.studyPlan)) {
    throw new ApplicationError('SERVER_ERROR', 'The study service returned an invalid study plan.');
  }
  return parsed.data.studyPlan;
}
