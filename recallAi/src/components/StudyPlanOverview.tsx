import type { StudyPlan } from '../../shared/studyPlan';

type Props = {
  plan: StudyPlan;
  onFlashcards: () => void;
  onQuiz: () => void;
};

export function StudyPlanOverview({ plan, onFlashcards, onQuiz }: Props) {
  return (
    <div className="study-overview">
      <span className="preview-label">READY TO STUDY</span>
      <h2>{plan.title}</h2>
      <p className="overview-summary">{plan.summary}</p>
      <div className="preview-counts" aria-label="Study set contents">
        <span>{plan.concepts.length} concepts</span>
        <span>{plan.flashcards.length} flashcards</span>
        <span>{plan.quiz.length} quiz questions</span>
      </div>
      <h3>Core concepts</h3>
      <ul className="concept-list">
        {plan.concepts.map((concept) => <li key={concept}>{concept}</li>)}
      </ul>
      <div className="action-row">
        <button type="button" onClick={onFlashcards}>Study flashcards</button>
        <button type="button" className="secondary-button" onClick={onQuiz}>Take quiz</button>
      </div>
    </div>
  );
}
