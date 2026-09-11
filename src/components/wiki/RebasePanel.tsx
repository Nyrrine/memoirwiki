import { useState } from 'react';
import { ProposalDiff, FieldDiff } from './admin/ProposalDiff';
import { Button } from '../ui';
import { unresolvedConflicts } from '../../lib/rebase';
import type { RebaseDecision, RebasePlan, RebaseRow } from '../../lib/rebase';
import type { WikiSection } from '../../types/wiki';
import type { ProposalForRebase } from '../../lib/wikiPersistence';
import styles from './RebasePanel.module.css';
const OUTCOME_TEXT: Record<string, string> = {
    conflict: 'You and the page both changed this section.',
    'removed-by-me-edited-by-them': 'You deleted this section. Someone else edited it instead - their version is kept until you say otherwise.',
    'removed-by-them-edited-by-me': 'Someone else deleted this section. You had edited it - your version is kept until you say otherwise.',
};
function sectionsOf(section: WikiSection | undefined): WikiSection[] {
    return section ? [section] : [];
}
interface RebasePanelProps {
    proposal: ProposalForRebase;
    plan: RebasePlan;
    decisions: ReadonlyMap<string, RebaseDecision>;
    baseSections: WikiSection[] | null;
    liveSections: WikiSection[];
    live: {
        title: string;
        subtitle: string | null;
        cover_image: string | null;
    };
    writesDirectly: boolean;
    overCapMessage: string | null;
    onDecide: (row: RebaseRow, decision: RebaseDecision) => void;
    onDismiss: () => void;
}
export function RebasePanel({ proposal, plan, decisions, baseSections, liveSections, live, writesDirectly, overCapMessage, onDecide, onDismiss, }: RebasePanelProps) {
    const [showPageChanges, setShowPageChanges] = useState(false);
    const unanswered = unresolvedConflicts(plan, decisions).length;
    return (<div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.badge}>Rebased</span>
        <div className={styles.headText}>
          <strong>Your version has been re-applied onto the current page.</strong>
          <span className={styles.sub}>
            {plan.cleanlyApplied > 0
            ? `${plan.cleanlyApplied} of your change${plan.cleanlyApplied === 1 ? '' : 's'} carried across on ${plan.cleanlyApplied === 1 ? 'its' : 'their'} own. `
            : ''}
            {plan.conflicts.length === 0
            ? 'Nothing needed a decision.'
            : `${plan.conflicts.length} section${plan.conflicts.length === 1 ? '' : 's'} need${plan.conflicts.length === 1 ? 's' : ''} a decision${unanswered > 0 ? ` - ${unanswered} still open.` : '.'}`}
          </span>
          <span className={styles.sub}>
            {writesDirectly
            ? 'You can write to this page directly, so Save publishes this merge to the live page. Nothing is written until you press it.'
            : 'Nothing is sent until you press Propose. Saving is still off the live page.'}
          </span>
        </div>
        <button type="button" className={styles.dismiss} onClick={onDismiss} title="Hide this">
          ×
        </button>
      </div>

      {overCapMessage && <p className={styles.blind}>{overCapMessage}</p>}

      {plan.blind && (<p className={styles.blind}>
          This proposal predates the record of what it was written against, so
          the merge cannot tell your edits from anyone else's. Every section
          that differs is listed below as a question rather than resolved -
          your version is in the editor, and "Take theirs" puts the live one
          back.
        </p>)}

      {baseSections !== null && (<div className={styles.pageChanges}>
          <button type="button" className={styles.disclosure} onClick={() => setShowPageChanges((v) => !v)}>
            {showPageChanges ? '▾' : '▸'} What changed on the page since you wrote this
          </button>
          {showPageChanges && (<div className={styles.diffWrap}>
              <ProposalDiff before={baseSections} after={liveSections}/>
            </div>)}
        </div>)}

      {plan.conflicts.length > 0 && (<div className={styles.conflicts}>
          {plan.conflicts.map((row) => {
                const chosen = decisions.get(row.id);
                return (<div key={row.id} className={styles.conflict}>
                <div className={styles.conflictHead}>
                  <span className={styles.conflictWhat}>
                    {OUTCOME_TEXT[row.outcome] ?? 'This section needs a decision.'}
                  </span>
                  {chosen && (<span className={styles.chosen}>
                      {chosen === 'mine' ? 'keeping yours' : chosen === 'theirs' ? 'taking theirs' : 'removed'}
                    </span>)}
                </div>
                <div className={styles.diffWrap}>
                  <ProposalDiff before={sectionsOf(row.theirs)} after={sectionsOf(row.mine)}/>
                </div>
                <div className={styles.actions}>
                  <Button size="sm" variant={chosen === 'mine' ? 'primary' : 'secondary'} disabled={!row.mine} onClick={() => onDecide(row, 'mine')}>
                    Keep mine
                  </Button>
                  <Button size="sm" variant={chosen === 'theirs' ? 'primary' : 'secondary'} disabled={!row.theirs} onClick={() => onDecide(row, 'theirs')}>
                    Take theirs
                  </Button>
                  <Button size="sm" variant={chosen === 'drop' ? 'primary' : 'secondary'} onClick={() => onDecide(row, 'drop')}>
                    Remove it
                  </Button>
                </div>
              </div>);
            })}
        </div>)}

      <div className={styles.fields}>
        <FieldDiff label="Title" before={live.title} after={proposal.title}/>
        <FieldDiff label="Subtitle" before={live.subtitle} after={proposal.subtitle}/>
        <FieldDiff label="Cover image" before={live.cover_image} after={proposal.cover_image}/>
      </div>
    </div>);
}
