import { describe, expect, it, vi } from 'vitest';
import { FLOW_START, stepOf, stepper, viewOf } from '@site/src/features/landing/service/playback';
import { FlowControls } from '@site/src/features/landing/view/FlowControls/FlowControls';
import { markupOf } from '@site/tests/support/markup';

const NOOP = vi.fn();

function controls(step: number, wantsPlay: boolean, live: string): React.ReactElement {
  const flow = { ...FLOW_START, step: stepOf(step), wantsPlay };
  const view = viewOf(flow);
  return (
    <FlowControls
      buttons={stepper(flow.step)}
      playing={wantsPlay}
      label={view.label}
      live={live}
      politeness={view.politeness}
      onChoose={NOOP}
      onToggle={NOOP}
      onReplay={NOOP}
    />
  );
}

describe('FlowControls', () => {
  it('puts the toggle first, named by its action and pressed while playing', () => {
    const $ = markupOf(controls(2, true, 'Step 2'));
    const first = $('button').first();
    expect(first.text()).toBe('Pause');
    expect(first.attr('aria-label')).toBe('Pause autoplay');
    expect(first.attr('aria-pressed')).toBe('true');
    expect($('button').eq(1).text()).toBe('Replay');
  });

  it('lists the seven steps and marks only the current one', () => {
    const $ = markupOf(controls(3, false, ''));
    expect($('[role="group"] button')).toHaveLength(7);
    expect($('[aria-current="step"]')).toHaveLength(1);
    expect($('[aria-current="step"]').text()).toContain('Sign in once');
  });

  it('announces politely when paused and not at all while playing', () => {
    expect(markupOf(controls(1, true, 'x'))('[role="status"]').attr('aria-live')).toBe('off');
    expect(markupOf(controls(1, false, 'x'))('[role="status"]').attr('aria-live')).toBe('polite');
  });
});
