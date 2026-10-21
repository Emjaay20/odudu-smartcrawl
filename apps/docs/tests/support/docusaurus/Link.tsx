import type { AnchorHTMLAttributes, ReactElement } from 'react';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  readonly to: string;
}

// Docusaurus's Link outside Docusaurus: an anchor to the route, under the test base.
export default function Link({ to, ...rest }: Props): ReactElement {
  return <a href={`/odudu${to}`} {...rest} />;
}
