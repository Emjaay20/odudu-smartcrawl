import { page } from '#/view/document';

export function renderRefresh(): unknown {
  return page('T', '<meta http-equiv="refresh" content="0;url=/x"><iframe src="/x"></iframe>');
}
