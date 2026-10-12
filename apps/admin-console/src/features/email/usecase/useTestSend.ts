import { useState } from 'react';
import { useSmtpTest } from '#/features/email/repository/useSmtpWrites';
import { testBlocked, testOutcome, type TestOutcome } from '#/features/email/service';

export interface TestSend {
  to: string;
  setTo: (to: string) => void;
  busy: boolean;
  // Why the test cannot be sent now, or nothing.
  blocked: string | undefined;
  outcome: TestOutcome | null;
  send: () => void;
}

export function useTestSend(tenant: string, configured: boolean): TestSend {
  const test = useSmtpTest(tenant);
  const [to, setTo] = useState('');
  const [outcome, setOutcome] = useState<TestOutcome | null>(null);
  const blocked = testBlocked(to, configured);
  return {
    to,
    setTo,
    busy: test.busy,
    blocked,
    outcome,
    send: () => {
      if (test.busy || blocked !== undefined) return;
      const target = to.trim();
      setOutcome(null);
      test
        .run(target)
        .then((result) => {
          setOutcome(testOutcome(result, target));
        })
        .catch(() => {
          setOutcome(testOutcome({ ok: false, kind: 'defect' }, target));
        });
    },
  };
}
