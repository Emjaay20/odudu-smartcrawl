import { MARK_PNG_BASE64 } from '#/service/mark.generated';

// The image the shell's header names as `cid:smartcrawl-mark`. The SMTP sender
// attaches it inline to any message whose markup refers to it, so no mail
// fetches anything from a server and a self-hosted install needs no public
// asset URL.
export const MARK_CID = 'smartcrawl-mark';

export function markAttachment(html: string): {
  readonly filename: string;
  readonly content: Buffer;
  readonly contentType: string;
  readonly cid: string;
  readonly contentDisposition: 'inline';
} | null {
  if (!html.includes(`cid:${MARK_CID}`)) return null;
  return {
    filename: 'smartcrawl.png',
    content: Buffer.from(MARK_PNG_BASE64, 'base64'),
    contentType: 'image/png',
    cid: MARK_CID,
    contentDisposition: 'inline',
  };
}
