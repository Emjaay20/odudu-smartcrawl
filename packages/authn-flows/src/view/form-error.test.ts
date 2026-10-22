import { describe, expect, it } from 'vitest';
import { firstInvalidField, invalidAttributes, problemSummary } from '#/view/form-error';

const PROBLEMS = [
  { fields: ['username'], html: 'That username is taken.' },
  { fields: [], html: 'Something else.' },
  { fields: ['password'], html: 'Too short.' },
  { fields: ['password'], html: 'No digit.' },
];

describe('problemSummary', () => {
  it('is empty when nothing went wrong', () => {
    expect(problemSummary([])).toBe('');
  });

  it('is one alert holding every message, each with its own id', () => {
    expect(problemSummary(PROBLEMS)).toBe(`<div class="alert" role="alert" id="form-error">
<ul>
<li id="form-error-0">That username is taken.</li>
<li id="form-error-1">Something else.</li>
<li id="form-error-2">Too short.</li>
<li id="form-error-3">No digit.</li>
</ul>
</div>
`);
  });
});

describe('invalidAttributes', () => {
  it('marks a field and points it at each of its own messages', () => {
    expect(invalidAttributes(PROBLEMS, 'password')).toBe(
      ' aria-invalid="true" aria-describedby="form-error-2 form-error-3"',
    );
    expect(invalidAttributes(PROBLEMS, 'username')).toBe(
      ' aria-invalid="true" aria-describedby="form-error-0"',
    );
  });

  it('says nothing about a field with no problem', () => {
    expect(invalidAttributes(PROBLEMS, 'email')).toBe('');
    expect(invalidAttributes([], 'email')).toBe('');
  });
});

describe('firstInvalidField', () => {
  it('is the first field in form order that has a problem', () => {
    expect(firstInvalidField(PROBLEMS, ['email', 'password', 'username'])).toBe('password');
    expect(firstInvalidField(PROBLEMS, ['username', 'password'])).toBe('username');
  });

  it('is null when no field is at fault', () => {
    expect(firstInvalidField([{ fields: [], html: 'x' }], ['username'])).toBeNull();
    expect(firstInvalidField([], ['username'])).toBeNull();
  });
});
