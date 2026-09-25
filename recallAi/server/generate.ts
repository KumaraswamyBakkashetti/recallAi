import type { Request, Response } from 'express';
import {
  assignStudyPlanIds,
  studyPlanContentSchema,
  validateStudySemantics,
  type StudyPlan,
} from '../shared/studyPlan.ts';
import { ProviderFailure, requestStudyContent } from './groq.ts';

type ErrorCode =
  | 'EMPTY_INPUT'
  | 'INVALID_INPUT'
  | 'INPUT_TOO_LONG'
  | 'EMPTY_AI_RESPONSE'
  | 'INVALID_AI_OUTPUT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR';

type ContentProvider = typeof requestStudyContent;

export class GenerationFailure extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly providerStatus?: number,
  ) {
    super(message);
    this.name = 'GenerationFailure';
  }
}

function sendError(response: Response, status: number, code: ErrorCode, message: string): void {
  response.status(status).json({ error: { code, message } });
}

function mapProviderError(error: unknown): GenerationFailure {
  if (error instanceof ProviderFailure && error.kind === 'timeout') {
    return new GenerationFailure(504, 'TIMEOUT', 'Generation timed out. Please try again.');
  }
  if (error instanceof ProviderFailure && error.kind === 'rate_limit') {
    return new GenerationFailure(429, 'RATE_LIMITED', 'The AI service is temporarily busy. Please try again shortly.', error.status);
  }
  return new GenerationFailure(
    502,
    'UPSTREAM_ERROR',
    'The study service is unavailable. Please try again.',
    error instanceof ProviderFailure ? error.status : undefined,
  );
}

export async function createStudyPlan(
  material: string,
  apiKey: string,
  provider: ContentProvider = requestStudyContent,
  timeoutMs = 25_000,
): Promise<StudyPlan> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderFailure('timeout'));
    }, timeoutMs);
  });

  let rawContent: string | null;
  try {
    rawContent = await Promise.race([provider(material, apiKey, controller.signal), deadline]);
  } catch (error: unknown) {
    throw mapProviderError(error);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!rawContent?.trim()) {
    throw new GenerationFailure(502, 'EMPTY_AI_RESPONSE', 'The study service returned an empty response. Please try again.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new GenerationFailure(502, 'INVALID_AI_OUTPUT', 'We could not build a study plan. Please try again.');
  }

  const validated = studyPlanContentSchema.safeParse(parsed);
  if (!validated.success || !validateStudySemantics(validated.data)) {
    throw new GenerationFailure(502, 'INVALID_AI_OUTPUT', 'We could not build a study plan. Please try again.');
  }

  return assignStudyPlanIds(validated.data);
}

export async function generateStudyPlan(request: Request, response: Response): Promise<void> {
  const body: unknown = request.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('material' in body)) {
    sendError(response, 400, 'INVALID_INPUT', 'Provide study material as text.');
    return;
  }

  const { material } = body;
  if (typeof material !== 'string') {
    sendError(response, 400, 'INVALID_INPUT', 'Provide study material as text.');
    return;
  }

  const trimmedMaterial = material.trim();
  if (!trimmedMaterial) {
    sendError(response, 400, 'EMPTY_INPUT', 'Enter a topic or some study material.');
    return;
  }
  if (trimmedMaterial.length > 8_000) {
    sendError(response, 400, 'INPUT_TOO_LONG', 'Keep study material under 8,000 characters.');
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    sendError(response, 500, 'SERVER_ERROR', 'Study plan generation is not configured yet.');
    return;
  }

  try {
    const studyPlan = await createStudyPlan(trimmedMaterial, apiKey);
    response.status(200).json({ studyPlan });
  } catch (error: unknown) {
    if (error instanceof GenerationFailure) {
      console.error('Study generation failed', { code: error.code, providerStatus: error.providerStatus });
      sendError(response, error.status, error.code, error.message);
    } else {
      console.error('Study generation failed', { code: 'SERVER_ERROR', errorType: error instanceof Error ? error.name : typeof error });
      sendError(response, 500, 'SERVER_ERROR', 'Something went wrong. Please try again.');
    }
  }
}

export { sendError };
