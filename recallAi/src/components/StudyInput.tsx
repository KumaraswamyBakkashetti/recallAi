import { useState, type FormEvent } from 'react';

type Props = {
  isLoading: boolean;
  hasPlan: boolean;
  onGenerate: (material: string) => void;
};

export function StudyInput({ isLoading, hasPlan, onGenerate }: Props) {
  const [material, setMaterial] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onGenerate(material);
  }

  return (
    <form className="study-form" onSubmit={submit}>
      <label htmlFor="material">What are you studying?</label>
      <p className="field-hint" id="material-hint">{hasPlan ? 'Enter new material to create another study set.' : 'Paste notes or enter a topic. We’ll turn it into a focused study plan.'}</p>
      <textarea
        id="material"
        name="material"
        value={material}
        onChange={(event) => setMaterial(event.target.value)}
        placeholder="Try: How does photosynthesis work?"
        rows={7}
        maxLength={8_000}
        aria-describedby="material-hint material-count"
      />
      <div className="form-footer">
        <span id="material-count" className="character-count">{material.length.toLocaleString()} / 8,000</span>
        <button type="submit" disabled={isLoading || !material.trim()} aria-busy={isLoading}>
          {isLoading ? 'Generating…' : hasPlan ? 'Generate new set' : 'Generate study plan'}
          {!isLoading && <span aria-hidden="true"> ↗</span>}
        </button>
      </div>
    </form>
  );
}
