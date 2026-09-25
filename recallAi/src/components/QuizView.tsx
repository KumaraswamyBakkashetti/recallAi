import { useEffect, useRef, type Dispatch, type FormEvent } from 'react';
import type { StudyPlan } from '../../shared/studyPlan';
import {
  activeQuizAnswers,
  activeQuizIds,
  quizResults,
  type SessionAction,
  type SessionState,
} from '../lib/studySession';

type Props = {
  plan: StudyPlan;
  session: SessionState;
  dispatch: Dispatch<SessionAction>;
};

export function QuizView({ plan, session, dispatch }: Props) {
  const questionRef = useRef<HTMLFieldSetElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const ids = activeQuizIds(plan, session);
  const answers = activeQuizAnswers(session);
  const result = quizResults(plan, ids, answers);
  const isRetest = session.quiz.round === 'retest';
  const currentAnswer = answers[ids[session.quiz.index]];

  useEffect(() => {
    if (session.quiz.completed) resultsRef.current?.focus();
    else if (currentAnswer !== undefined) feedbackRef.current?.focus();
    else questionRef.current?.focus();
  }, [session.quiz.index, session.quiz.round, session.quiz.completed, currentAnswer]);

  if (session.quiz.completed) {
    return (
      <div className="completion-view">
        <span className="preview-label">{isRetest ? 'RETEST RESULTS' : 'QUIZ RESULTS'}</span>
        <h2 tabIndex={-1} ref={resultsRef}>{result.correct} / {result.total} correct</h2>
        <p>You answered {result.correct} correctly and {result.incorrect} incorrectly.</p>
        <div className="score-meter" aria-label={`${result.percentage}% correct`}>{result.percentage}%</div>
        <div className="action-row">
          {result.wrongIds.length > 0 && (
            <button type="button" onClick={() => dispatch({ type: 'QUIZ_RETEST', ids: result.wrongIds })}>
              Retest wrong answers
            </button>
          )}
          {isRetest && (
            <button type="button" className="secondary-button" onClick={() => dispatch({ type: 'QUIZ_RETURN_TO_ALL' })}>View full quiz results</button>
          )}
          <button type="button" className="secondary-button" onClick={() => dispatch({ type: 'OPEN', mode: 'overview' })}>Back to overview</button>
        </div>
      </div>
    );
  }

  const questionId = ids[session.quiz.index];
  const question = plan.quiz.find((item) => item.id === questionId);
  if (!question) return <p className="inline-error">This quiz question is unavailable. Return to the overview.</p>;

  const submittedAnswer = answers[question.id];
  const isSubmitted = submittedAnswer !== undefined;
  const isCorrect = submittedAnswer === question.correctOptionIndex;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (question) dispatch({ type: 'QUIZ_SUBMIT', id: question.id });
  }

  return (
    <div className="study-flow">
      <h2 className="sr-only">{isRetest ? 'Wrong answer retest' : 'Quiz'}</h2>
      <div className="flow-topline">
        <span className="preview-label">{isRetest ? 'WRONG ANSWER RETEST' : 'QUIZ'}</span>
        <span>Question {session.quiz.index + 1} of {ids.length}</span>
      </div>
      {isRetest && <button type="button" className="text-button return-button" onClick={() => dispatch({ type: 'QUIZ_RETURN_TO_ALL' })}>View full quiz results</button>}
      <div className="progress-track quiz-progress" role="progressbar" aria-label="Quiz questions completed" aria-valuemin={0} aria-valuemax={ids.length} aria-valuenow={Object.keys(answers).length}>
        <span style={{ width: `${(Object.keys(answers).length / ids.length) * 100}%` }} />
      </div>

      <form className="quiz-form" onSubmit={submit}>
        <fieldset disabled={isSubmitted} tabIndex={-1} ref={questionRef}>
          <legend>{question.question}</legend>
          <div className="quiz-options">
            {question.options.map((option, index) => (
              <label key={`${question.id}-${option}`} className={`quiz-option ${isSubmitted && index === question.correctOptionIndex ? 'correct-option' : ''} ${isSubmitted && index === submittedAnswer && !isCorrect ? 'incorrect-option' : ''}`}>
                <input
                  type="radio"
                  name={`answer-${question.id}`}
                  value={index}
                  checked={(isSubmitted ? submittedAnswer : session.quiz.selectedOptionIndex) === index}
                  onChange={() => dispatch({ type: 'QUIZ_SELECT', id: question.id, optionIndex: index })}
                />
                <span>{option}</span>
                {isSubmitted && index === question.correctOptionIndex && <span className="option-note">Correct answer</span>}
                {isSubmitted && index === submittedAnswer && !isCorrect && <span className="option-note">Your answer</span>}
              </label>
            ))}
          </div>
        </fieldset>
        {!isSubmitted && <button type="submit" disabled={session.quiz.selectedOptionIndex === null}>Submit answer</button>}
      </form>

      {isSubmitted && (
        <div className={`answer-feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`} role="status" tabIndex={-1} ref={feedbackRef}>
          <strong>{isCorrect ? 'Correct' : 'Incorrect'}</strong>
          <p>{question.explanation}</p>
          <button type="button" onClick={() => dispatch({ type: 'QUIZ_NEXT', id: question.id, total: ids.length })}>
            {session.quiz.index === ids.length - 1 ? 'See results' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  );
}
