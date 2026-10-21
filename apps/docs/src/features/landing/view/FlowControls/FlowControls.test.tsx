import { describe, expect, it, vi } from 'vitest';
import { FlowControls } from '@site/src/features/landing/view/FlowControls/FlowControls';
import { markupOf } from '@site/tests/support/markup';

const NOOP = vi.fn();

describe('FlowControls', () => {
  it('puts the toggle first, named by its action and pressed while playing', () => {
    const $ = markupOf(
      <FlowControls
        step={2}
        playing
        live="Step 2"
        onChoose={NOOP}
        onToggle={NOOP}
        onReplay={NOOP}
      />,
    );
    const first = $('button').first();
    expect(first.text()).toBe('Pause');
    expect(first.attr('aria-label')).toBe('Pause autoplay');
    expect(first.attr('aria-pressed')).toBe('true');
    expect($('button').eq(1).text()).toBe('Replay');
  });

  it('lists the seven steps and marks only the current one', () => {
    const $ = markupOf(
      <FlowControls
        step={3}
        playing={false}
        live=""
        onChoose={NOOP}
        onToggle={NOOP}
        onReplay={NOOP}
      />,
    );
    expect($('[role="group"] button')).toHaveLength(7);
    expect($('[aria-current="step"]')).toHaveLength(1);
    expect($('[aria-current="step"]').text()).toContain('Sign in once');
  });

  it('announces politely when paused and not at all while playing', () => {
    const playing = markupOf(
      <FlowControls step={1} playing live="x" onChoose={NOOP} onToggle={NOOP} onReplay={NOOP} />,
    );
    const paused = markupOf(
      <FlowControls
        step={1}
        playing={false}
        live="x"
        onChoose={NOOP}
        onToggle={NOOP}
        onReplay={NOOP}
      />,
    );
    expect(playing('[role="status"]').attr('aria-live')).toBe('off');
    expect(paused('[role="status"]').attr('aria-live')).toBe('polite');
  });
});
