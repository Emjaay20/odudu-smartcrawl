import { PREVIEW_LOADING } from '#/features/branding/service';
import styles from '#/features/branding/view/PreviewFrame/PreviewFrame.module.css';

// A page of the server in a frame that may run nothing and shares no origin
// with the console. Its height is fixed, so the page does not move when the
// frame reloads.
export function PreviewFrame({
  title,
  src,
  frameKey,
  loading,
  onLoaded,
}: {
  title: string;
  src: string;
  // Reloads the frame when what it shows has changed.
  frameKey: string;
  loading: boolean;
  onLoaded: () => void;
}) {
  return (
    <div className={styles.frame} data-loading={loading || undefined}>
      <iframe
        key={frameKey}
        className={styles.iframe}
        title={title}
        src={src}
        sandbox=""
        referrerPolicy="no-referrer"
        onLoad={onLoaded}
      />
      {loading ? (
        <p role="status" className={styles.loading}>
          {PREVIEW_LOADING}
        </p>
      ) : null}
    </div>
  );
}
