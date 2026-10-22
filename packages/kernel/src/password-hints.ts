import { scriptNonce } from '#/ids';
import { type PageScript } from '#/page';

// What a page tells a person about the password they are about to choose.
// The rules are the tenant's own; the blocklist is checked by the server
// when the form is submitted and is only named here.
export interface PasswordRules {
  minLength: number;
  requireDigit: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireSpecial: boolean;
}

// Already-escaped markup, from the page's own catalogue: no package's
// messages live in this one.
export interface PasswordHintText {
  heading: string;
  minLength: string;
  digit: string;
  uppercase: string;
  lowercase: string;
  special: string;
  notCommon: string;
  show: string;
  hide: string;
}

export const PASSWORD_FIELD_ID = 'password';
export const PASSWORD_RULES_LIST_ID = 'password-rules-list';

// The characters the server counts, the way it counts them: code points of
// the NFC form. The character rules read exactly as evaluatePassword reads
// them. The toggle is hidden until this runs, so a page without it shows a
// plain list and no control that does nothing.
export const PASSWORD_HINTS_SCRIPT = `(function () {
  var box = document.getElementById('password-rules');
  var field = document.getElementById('${PASSWORD_FIELD_ID}');
  if (!box || !field) return;
  var rows = box.querySelectorAll('li[data-rule]');
  var min = Number(box.getAttribute('data-min'));
  var tests = {
    length: function (v) { return Array.from(v.normalize('NFC')).length >= min; },
    digit: function (v) { return /\\d/u.test(v); },
    uppercase: function (v) { return /[A-Z]/u.test(v); },
    lowercase: function (v) { return /[a-z]/u.test(v); },
    special: function (v) { return /[^A-Za-z0-9]/u.test(v); }
  };
  function check() {
    Array.from(rows).forEach(function (row) {
      row.setAttribute('data-met', String(tests[row.getAttribute('data-rule')](field.value)));
    });
  }
  box.setAttribute('data-live', '');
  field.addEventListener('input', check);
  check();
  var toggle = box.querySelector('button');
  if (!toggle) return;
  toggle.hidden = false;
  toggle.addEventListener('click', function () {
    var show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    toggle.textContent = toggle.getAttribute(show ? 'data-hide' : 'data-show');
    toggle.setAttribute('aria-pressed', String(show));
  });
})();`;

export interface PasswordHints {
  // The list, the toggle and the script element, each line indented two
  // spaces to sit inside a form, to follow the field's label.
  markup: string;
  // What the page returns, so the policy it is sent with names this script.
  script: PageScript;
  // Attributes for the field itself: the id the script and the label use and
  // the minimum the browser can check.
  field: string;
}

function item(rule: string | null, text: string): string {
  return rule === null ? `<li>${text}</li>` : `<li data-rule="${rule}">${text}</li>`;
}

export function passwordHints(rules: PasswordRules, text: PasswordHintText): PasswordHints {
  const nonce = scriptNonce();
  const lines = [
    item('length', text.minLength),
    ...(rules.requireDigit ? [item('digit', text.digit)] : []),
    ...(rules.requireUppercase ? [item('uppercase', text.uppercase)] : []),
    ...(rules.requireLowercase ? [item('lowercase', text.lowercase)] : []),
    ...(rules.requireSpecial ? [item('special', text.special)] : []),
    item(null, text.notCommon),
  ];
  const min = String(rules.minLength);
  return {
    markup: `  <div class="rules" id="password-rules" data-min="${min}">
    <p class="rules-head"><span>${text.heading}</span><button type="button" class="quiet" hidden aria-controls="${PASSWORD_FIELD_ID}" aria-pressed="false" data-show="${text.show}" data-hide="${text.hide}">${text.show}</button></p>
    <ul id="${PASSWORD_RULES_LIST_ID}">
${lines.map((line) => `      ${line}`).join('\n')}
    </ul>
  </div>
  <script nonce="${nonce}">${PASSWORD_HINTS_SCRIPT}</script>`,
    script: { nonce, fetchesSameOrigin: false },
    field: ` id="${PASSWORD_FIELD_ID}" minlength="${min}"`,
  };
}
