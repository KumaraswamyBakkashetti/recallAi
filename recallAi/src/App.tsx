import { useEffect, useReducer, useRef } from 'react';
import { FlashcardView } from './components/FlashcardView';
import { QuizView } from './components/QuizView';
import { StudyInput } from './components/StudyInput';
import { StudyPlanOverview } from './components/StudyPlanOverview';
import { useStudyGeneration } from './hooks/useStudyGeneration';
import { createInitialSession, studySessionReducer, type StudyMode } from './lib/studySession';

function App() {
  const { studyPlan, isLoading, isSlow, error, generate } = useStudyGeneration();
  const [session, dispatch] = useReducer(studySessionReducer, undefined, createInitialSession);
  const workspaceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (studyPlan) workspaceRef.current?.focus();
  }, [session.mode, studyPlan]);

  async function handleGenerate(material: string) {
    const newPlan = await generate(material);
    if (newPlan) dispatch({ type: 'RESET' });
  }

  function modeButton(mode: StudyMode, label: string) {
    return (
      <button type="button" className="mode-button" aria-pressed={session.mode === mode} onClick={() => dispatch({ type: 'OPEN', mode })}>
        {label}
      </button>
    );
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">R</div>
        <span className="brand-name">RecallAI</span>
        <span className="header-label">YOUR STUDY SPACE</span>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <div className="eyebrow"><span className="eyebrow-line" /> LEARN WITH INTENTION</div>
          <h1 id="page-title">Make what you learn <em>stick.</em></h1>
          <p>Bring your notes, or just a topic. RecallAI shapes them into a clear plan for studying and self-testing.</p>
        </section>

        <div className="content-grid">
          <StudyInput isLoading={isLoading} hasPlan={Boolean(studyPlan)} onGenerate={handleGenerate} />

          <div className="workspace-column">
            {error && (
              <div className="error-banner" role="alert">
                <strong>Couldn’t generate a study set.</strong> {error}
              </div>
            )}
            {isLoading && studyPlan && <div className="loading-banner" role="status">{isSlow ? 'This is taking longer than usual. Your current set is still available.' : 'Creating a new set. Your current study set is still available.'}</div>}

            <section className="result-panel" ref={workspaceRef} tabIndex={-1} aria-label={studyPlan ? `${session.mode} for ${studyPlan.title}` : 'Study workspace'} aria-busy={isLoading && !studyPlan}>
              <div className="panel-heading">
                <span className="panel-icon" aria-hidden="true">✦</span>
                <span>YOUR STUDY SPACE</span>
              </div>

              {studyPlan ? (
                <>
                  <nav className="mode-nav" aria-label="Study sections">
                    {modeButton('overview', 'Overview')}
                    {modeButton('flashcards', 'Flashcards')}
                    {modeButton('quiz', 'Quiz')}
                  </nav>
                  {session.mode === 'overview' && (
                    <StudyPlanOverview plan={studyPlan} onFlashcards={() => dispatch({ type: 'OPEN', mode: 'flashcards' })} onQuiz={() => dispatch({ type: 'OPEN', mode: 'quiz' })} />
                  )}
                  {session.mode === 'flashcards' && <FlashcardView plan={studyPlan} session={session} dispatch={dispatch} />}
                  {session.mode === 'quiz' && <QuizView plan={studyPlan} session={session} dispatch={dispatch} />}
                </>
              ) : isLoading ? (
                <div className="result-state" role="status">
                  <div className="loading-spinner" aria-hidden="true" />
                  <h2>Building your study set</h2>
                  <p>{isSlow ? 'This is taking longer than usual. Please wait a little longer.' : 'Turning your material into something you can study.'}</p>
                </div>
              ) : (
                <div className="result-state empty-state">
                  <div className="empty-illustration" aria-hidden="true">
                    <span className="paper paper-back" />
                    <span className="paper paper-front"><i /><i /><i /></span>
                    <span className="sparkle">✦</span>
                  </div>
                  <h2>A little clarity goes a long way.</h2>
                  <p>Your study set will appear here once you generate it.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <footer className="site-footer">Learn it. Recall it. Own it.</footer>
    </div>
  );
}

export default App;
