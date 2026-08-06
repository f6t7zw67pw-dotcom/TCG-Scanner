import { safeHttpUrl } from '../lib/links';
import type { Candidate } from '../types';

export function CandidateList({ candidates, onSelect }: { candidates: Candidate[]; onSelect: (candidate: Candidate) => void }) {
  if (!candidates.length) return <p className="muted">Keine passenden Katalogtreffer.</p>;
  return <div className="candidate-list">
    {candidates.map((candidate, index) => {
      const image = safeHttpUrl(candidate.imageSmall);
      return <article className="candidate" key={candidate.id || `${candidate.name}-${index}`}>
        {image && <img src={image} alt="" />}
        <div><strong>{candidate.name || candidate.cardmarketName || 'Unbenannt'}</strong>
          <p>{[candidate.setName, candidate.setCode, candidate.number || candidate.fullNumber, candidate.rarity].filter(Boolean).join(' · ')}</p>
          <div className="button-row"><button type="button" onClick={() => onSelect(candidate)}>Treffer bestätigen</button>
            {typeof candidate.score === 'number' && <span className="score">Score {candidate.score}</span>}
          </div>
        </div>
      </article>;
    })}
  </div>;
}
