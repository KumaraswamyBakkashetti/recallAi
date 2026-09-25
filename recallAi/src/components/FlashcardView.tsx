import { useEffect, useRef, type Dispatch } from 'react';
import type { StudyPlan } from '../../shared/studyPlan';
import {
  activeCardIds,
  activeCardRatings,
  cardCounts,
  type SessionAction,
  type SessionState,
} from '../lib/studySession';

type Props = {
  plan: StudyPlan;
  session: SessionState;
  dispatch: Dispatch<SessionAction>;
};

export function FlashcardView({ plan, session, dispatch }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (session.flashcards.completed) summaryRef.current?.focus();
    else cardRef.current?.focus();
  }, [session.flashcards.completed, session.flashcards.round, session.flashcards.index, session.flashcards.revealed]);

  const ids = activeCardIds(plan, session);
  const ratings = activeCardRatings(session);
  const counts = cardCounts(ids, ratings);
  const missedIds = ids.filter((id) => ratings[id] === 'missed');
  const cardId = ids[session.flashcards.index];
  const card = plan.flashcards.find((item) => item.id === cardId);
  const isRetest = session.flashcards.round === 'retest';

  if (session.flashcards.completed) {
    return (
      <div className="completion-view">
        <span className="preview-label">{isRetest ? 'RETEST COMPLETE' : 'FLASHCARDS COMPLETE'}</span>
        <h2 tabIndex={-1} ref={summaryRef}>{isRetest ? 'A second look pays off.' : 'You made it through the cards.'}</h2>
        <p>Here is how this {isRetest ? 'retest' : 'review'} went.</p>
        <div className="summary-stats">
          <div><strong>{counts.known}</strong><span>Known</span></div>
          <div><strong>{counts.missed}</strong><span>Missed</span></div>
          <div><strong>{counts.unreviewed}</strong><span>Unreviewed</span></div>
        </div>
        <div className="action-row">
          {missedIds.length > 0 && (
            <button type="button" onClick={() => dispatch({ type: 'CARD_RETEST', ids: missedIds })}>
              Retest missed cards
            </button>
          )}
          <button type="button" className={missedIds.length ? 'secondary-button' : undefined} onClick={() => dispatch({ type: 'OPEN', mode: 'quiz' })}>
            Take quiz
          </button>
          {counts.unreviewed > 0 && (
            <button type="button" className="text-button" onClick={() => dispatch({ type: 'CARD_RESUME' })}>
              Review cards again
            </button>
          )}
          {isRetest && (
            <button type="button" className="text-button" onClick={() => dispatch({ type: 'CARD_RETURN_TO_ALL' })}>
              Return to all flashcards
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!card) return <p className="inline-error">This flashcard is unavailable. Return to the overview.</p>;

  const rating = ratings[card.id];
  const atLastCard = session.flashcards.index === ids.length - 1;

  return (
    <div className="study-flow">
      <h2 className="sr-only">{isRetest ? 'Missed flashcard retest' : 'Flashcards'}</h2>
      <div className="flow-topline">
        <span className="preview-label">{isRetest ? 'MISSED CARD RETEST' : 'FLASHCARDS'}</span>
        <span>Card {session.flashcards.index + 1} of {ids.length}</span>
      </div>
      {isRetest && <button type="button" className="text-button return-button" onClick={() => dispatch({ type: 'CARD_RETURN_TO_ALL' })}>Return to all flashcards</button>}
      <div className="progress-copy">
        <span>{counts.reviewed} of {ids.length} reviewed</span>
        <span>{counts.missed} missed</span>
      </div>
      <div className="progress-track" role="progressbar" aria-label="Flashcards reviewed" aria-valuemin={0} aria-valuemax={ids.length} aria-valuenow={counts.reviewed}>
        <span style={{ width: `${(counts.reviewed / ids.length) * 100}%` }} />
      </div>

      <article className="flashcard" aria-live="polite" tabIndex={-1} ref={cardRef}>
        <div className="card-meta">
          <span>{session.flashcards.revealed ? 'ANSWER' : 'QUESTION'}</span>
          {rating && <span className={`rating-badge ${rating}`}>{rating === 'known' ? 'Known' : 'Missed'}</span>}
        </div>
        <p className={session.flashcards.revealed ? 'answer-text' : 'question-text'}>
          {session.flashcards.revealed ? card.answer : card.question}
        </p>
        {!session.flashcards.revealed ? (
          <button type="button" onClick={() => dispatch({ type: 'CARD_REVEAL' })}>Reveal answer</button>
        ) : (
          <div className="rating-actions" aria-label="Rate this flashcard">
            <button type="button" aria-pressed={rating === 'known'} className={rating === 'known' ? 'selected-rating' : 'secondary-button'} onClick={() => dispatch({ type: 'CARD_RATE', id: card.id, rating: 'known' })}>I know this</button>
            <button type="button" aria-pressed={rating === 'missed'} className={rating === 'missed' ? 'selected-rating missed-button' : 'secondary-button'} onClick={() => dispatch({ type: 'CARD_RATE', id: card.id, rating: 'missed' })}>I missed this</button>
          </div>
        )}
      </article>

      <div className="navigation-row">
        <button type="button" className="secondary-button" disabled={session.flashcards.index === 0} onClick={() => dispatch({ type: 'CARD_MOVE', index: session.flashcards.index - 1, total: ids.length })}>Previous</button>
        {atLastCard ? (
          <button type="button" onClick={() => dispatch({ type: 'CARD_COMPLETE', total: ids.length })}>Finish review</button>
        ) : (
          <button type="button" onClick={() => dispatch({ type: 'CARD_MOVE', index: session.flashcards.index + 1, total: ids.length })}>Next card</button>
        )}
      </div>
    </div>
  );
}
