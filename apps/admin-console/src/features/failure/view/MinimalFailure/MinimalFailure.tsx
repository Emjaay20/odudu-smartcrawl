import {
  FAILURE_TITLE,
  RELOAD_LABEL,
  ROOT_FAILURE_TEXT,
  type FailureReport,
} from '#/features/failure/service';
import { buttonClass } from '#/shared/view/Button';
import styles from '#/features/failure/view/MinimalFailure/MinimalFailure.module.css';

// What is left when the failure screen itself failed: a heading, a sentence, the
// id the first failure was logged under and a link to the same address, which
// loads it again. Nothing here can fail but a string and an anchor.
export function MinimalFailure({ report }: { report: FailureReport | null }) {
  return (
    <main className={styles.minimal}>
      <h1>{FAILURE_TITLE}</h1>
      <p>{ROOT_FAILURE_TEXT}</p>
      {report === null ? null : <p>{`Error ID: ${report.id}`}</p>}
      <a className={buttonClass} data-variant="primary" href={window.location.href}>
        {RELOAD_LABEL}
      </a>
    </main>
  );
}
