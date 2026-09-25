import { useEffect, useRef, useState } from 'react';
import type { StudyPlan } from '../../shared/studyPlan';
import { ApplicationError, generateStudyPlan } from '../lib/api';

export function useStudyGeneration() {
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const activeMaterial = useRef<string | null>(null);

  useEffect(() => () => {
    requestId.current += 1;
    controller.current?.abort();
  }, []);

  async function generate(material: string): Promise<StudyPlan | null> {
    const trimmed = material.trim();
    if (!trimmed) {
      setError('Enter a topic or some study material.');
      return null;
    }
    if (trimmed.length > 8_000) {
      setError('Keep study material under 8,000 characters.');
      return null;
    }
    if (controller.current && activeMaterial.current === trimmed) return null;

    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    activeMaterial.current = trimmed;
    const currentRequestId = ++requestId.current;
    setIsLoading(true);
    setIsSlow(false);
    setError(null);
    const slowTimer = setTimeout(() => {
      if (requestId.current === currentRequestId) setIsSlow(true);
    }, 8_000);

    try {
      const plan = await generateStudyPlan(trimmed, nextController.signal);
      if (requestId.current === currentRequestId) {
        setStudyPlan(plan);
        return plan;
      }
    } catch (caught: unknown) {
      if (requestId.current !== currentRequestId || nextController.signal.aborted) return null;
      setError(caught instanceof ApplicationError ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      clearTimeout(slowTimer);
      if (requestId.current === currentRequestId) {
        setIsLoading(false);
        setIsSlow(false);
        controller.current = null;
        activeMaterial.current = null;
      }
    }
    return null;
  }

  return { studyPlan, isLoading, isSlow, error, generate };
}
