import type { StudyPlan } from '../../shared/studyPlan';

export type StudyMode = 'overview' | 'flashcards' | 'quiz';
export type CardRating = 'known' | 'missed';
type Round = 'all' | 'retest';

export type SessionState = {
  mode: StudyMode;
  flashcards: {
    round: Round;
    index: number;
    revealed: boolean;
    completed: boolean;
    allCompleted: boolean;
    ratingsById: Record<string, CardRating>;
    retestIds: string[];
    retestRatingsById: Record<string, CardRating>;
  };
  quiz: {
    round: Round;
    index: number;
    selectedOptionIndex: number | null;
    completed: boolean;
    allCompleted: boolean;
    answersById: Record<string, number>;
    retestIds: string[];
    retestAnswersById: Record<string, number>;
  };
};

export type SessionAction =
  | { type: 'RESET' }
  | { type: 'OPEN'; mode: StudyMode }
  | { type: 'CARD_REVEAL' }
  | { type: 'CARD_MOVE'; index: number; total: number }
  | { type: 'CARD_RATE'; id: string; rating: CardRating }
  | { type: 'CARD_COMPLETE'; total: number }
  | { type: 'CARD_RESUME' }
  | { type: 'CARD_RETURN_TO_ALL' }
  | { type: 'CARD_RETEST'; ids: string[] }
  | { type: 'QUIZ_SELECT'; id: string; optionIndex: number }
  | { type: 'QUIZ_SUBMIT'; id: string }
  | { type: 'QUIZ_NEXT'; id: string; total: number }
  | { type: 'QUIZ_RETURN_TO_ALL' }
  | { type: 'QUIZ_RETEST'; ids: string[] };

export function createInitialSession(): SessionState {
  return {
    mode: 'overview',
    flashcards: {
      round: 'all', index: 0, revealed: false, completed: false, allCompleted: false,
      ratingsById: {}, retestIds: [], retestRatingsById: {},
    },
    quiz: {
      round: 'all', index: 0, selectedOptionIndex: null, completed: false, allCompleted: false,
      answersById: {}, retestIds: [], retestAnswersById: {},
    },
  };
}

export function activeCardIds(plan: StudyPlan, state: SessionState): string[] {
  return state.flashcards.round === 'retest'
    ? state.flashcards.retestIds
    : plan.flashcards.map((card) => card.id);
}

export function activeCardRatings(state: SessionState): Record<string, CardRating> {
  return state.flashcards.round === 'retest'
    ? state.flashcards.retestRatingsById
    : state.flashcards.ratingsById;
}

export function cardCounts(ids: string[], ratings: Record<string, CardRating>) {
  const known = ids.filter((id) => ratings[id] === 'known').length;
  const missed = ids.filter((id) => ratings[id] === 'missed').length;
  return { known, missed, reviewed: known + missed, unreviewed: ids.length - known - missed };
}

export function activeQuizIds(plan: StudyPlan, state: SessionState): string[] {
  return state.quiz.round === 'retest'
    ? state.quiz.retestIds
    : plan.quiz.map((question) => question.id);
}

export function activeQuizAnswers(state: SessionState): Record<string, number> {
  return state.quiz.round === 'retest'
    ? state.quiz.retestAnswersById
    : state.quiz.answersById;
}

export function quizResults(plan: StudyPlan, ids: string[], answers: Record<string, number>) {
  const questionsById = new Map(plan.quiz.map((question) => [question.id, question]));
  const wrongIds = ids.filter((id) => {
    const question = questionsById.get(id);
    return question && answers[id] !== undefined && answers[id] !== question.correctOptionIndex;
  });
  const correct = ids.filter((id) => {
    const question = questionsById.get(id);
    return question && answers[id] === question.correctOptionIndex;
  }).length;
  return {
    total: ids.length,
    correct,
    incorrect: wrongIds.length,
    percentage: ids.length ? Math.round((correct / ids.length) * 100) : 0,
    wrongIds,
  };
}

export function studySessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'RESET':
      return createInitialSession();
    case 'OPEN':
      return { ...state, mode: action.mode };
    case 'CARD_REVEAL':
      if (state.flashcards.completed) return state;
      return { ...state, flashcards: { ...state.flashcards, revealed: true } };
    case 'CARD_MOVE':
      if (state.flashcards.completed || action.index < 0 || action.index >= action.total) return state;
      return { ...state, flashcards: { ...state.flashcards, index: action.index, revealed: false } };
    case 'CARD_RATE': {
      if (!state.flashcards.revealed || state.flashcards.completed) return state;
      const key = state.flashcards.round === 'retest' ? 'retestRatingsById' : 'ratingsById';
      return {
        ...state,
        flashcards: {
          ...state.flashcards,
          [key]: { ...state.flashcards[key], [action.id]: action.rating },
        },
      };
    }
    case 'CARD_COMPLETE':
      if (state.flashcards.index !== action.total - 1) return state;
      return { ...state, flashcards: {
        ...state.flashcards, completed: true,
        allCompleted: state.flashcards.round === 'all' || state.flashcards.allCompleted,
      } };
    case 'CARD_RESUME':
      return { ...state, mode: 'flashcards', flashcards: { ...state.flashcards, completed: false, index: 0, revealed: false } };
    case 'CARD_RETURN_TO_ALL':
      return { ...state, mode: 'flashcards', flashcards: {
        ...state.flashcards, round: 'all', completed: state.flashcards.allCompleted,
        index: 0, revealed: false,
      } };
    case 'CARD_RETEST': {
      const missedIds = [...new Set(action.ids)].filter((id) => activeCardRatings(state)[id] === 'missed');
      if (!missedIds.length) return state;
      return {
        ...state, mode: 'flashcards',
        flashcards: {
          ...state.flashcards, round: 'retest', retestIds: missedIds,
          retestRatingsById: {}, index: 0, revealed: false, completed: false,
        },
      };
    }
    case 'QUIZ_SELECT': {
      const answers = activeQuizAnswers(state);
      if (state.quiz.completed || answers[action.id] !== undefined || action.optionIndex < 0 || action.optionIndex > 3) return state;
      return { ...state, quiz: { ...state.quiz, selectedOptionIndex: action.optionIndex } };
    }
    case 'QUIZ_SUBMIT': {
      const selected = state.quiz.selectedOptionIndex;
      const answers = activeQuizAnswers(state);
      if (state.quiz.completed || selected === null || answers[action.id] !== undefined) return state;
      const key = state.quiz.round === 'retest' ? 'retestAnswersById' : 'answersById';
      return { ...state, quiz: { ...state.quiz, [key]: { ...state.quiz[key], [action.id]: selected } } };
    }
    case 'QUIZ_NEXT': {
      if (activeQuizAnswers(state)[action.id] === undefined || state.quiz.completed) return state;
      if (state.quiz.index === action.total - 1) {
        return { ...state, quiz: {
          ...state.quiz, completed: true,
          allCompleted: state.quiz.round === 'all' || state.quiz.allCompleted,
        } };
      }
      return { ...state, quiz: { ...state.quiz, index: state.quiz.index + 1, selectedOptionIndex: null } };
    }
    case 'QUIZ_RETURN_TO_ALL':
      return { ...state, mode: 'quiz', quiz: {
        ...state.quiz, round: 'all', completed: state.quiz.allCompleted,
        index: 0, selectedOptionIndex: null,
      } };
    case 'QUIZ_RETEST':
      if (!action.ids.length) return state;
      return {
        ...state, mode: 'quiz',
        quiz: {
          ...state.quiz, round: 'retest', retestIds: [...new Set(action.ids)],
          retestAnswersById: {}, index: 0, selectedOptionIndex: null, completed: false,
        },
      };
  }
}
