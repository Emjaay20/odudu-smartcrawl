import { describe, expect, it } from 'vitest';
import { startDomReveal, type RevealEnv } from '@site/src/features/landing/service/revealDom';

class Spot {
  attributes = new Set<string>();
  constructor(public top: number) {}
  getBoundingClientRect(): { top: number } {
    return { top: this.top };
  }
  setAttribute(name: string): void {
    this.attributes.add(name);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

interface Fake {
  env: RevealEnv;
  seen: (target: Spot) => void;
  scroll: () => void;
  listeners: Map<string, () => void>;
}

function fakeEnv(spots: Spot[]): Fake {
  const listeners = new Map<string, () => void>();
  let report: ((entries: { target: unknown; isIntersecting: boolean }[]) => void) | undefined;
  class Observer {
    constructor(callback: (entries: { target: unknown; isIntersecting: boolean }[]) => void) {
      report = callback;
    }
    observe(): undefined {
      return undefined;
    }
    disconnect(): undefined {
      return undefined;
    }
  }
  const env = {
    document: { querySelectorAll: () => spots },
    window: {
      innerHeight: 800,
      addEventListener: (name: string, handler: () => void) => listeners.set(name, handler),
      removeEventListener: (name: string) => listeners.delete(name),
      requestAnimationFrame: (run: () => void) => {
        run();
        return 1;
      },
      cancelAnimationFrame: () => undefined,
    },
    Observer,
  } as unknown as RevealEnv;
  return {
    env,
    seen: (target) => report?.([{ target, isIntersecting: true }]),
    scroll: () => listeners.get('scroll')?.(),
    listeners,
  };
}

describe('the reveal over a page', () => {
  it('marks what is below the first screen pending and releases it when it is seen', () => {
    const top = new Spot(100);
    const low = new Spot(1200);
    const fake = fakeEnv([top, low]);
    const stop = startDomReveal(fake.env);
    expect([...top.attributes]).toEqual([]);
    expect([...low.attributes]).toEqual(['data-pending']);
    fake.seen(low);
    expect([...low.attributes]).toEqual([]);
    stop?.();
    expect(fake.listeners.size).toBe(0);
  });

  it('releases what a jump scrolled past, and puts the rest back when stopped', () => {
    const near = new Spot(1000);
    const far = new Spot(5000);
    const fake = fakeEnv([near, far]);
    const stop = startDomReveal(fake.env);
    near.top = -3000;
    fake.scroll();
    expect([...near.attributes]).toEqual([]);
    expect([...far.attributes]).toEqual(['data-pending']);
    stop?.();
    expect([...far.attributes]).toEqual([]);
  });
});
