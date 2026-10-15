import { session } from '#/features/session';
import { Button } from '#/shared/view/Button';
import styles from '#/features/groups/view/Tab.module.css';
import { here } from '#/features/groups/usecase/useHere';

export const shown = [Button, session, styles, here];
