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
  // With `{met}` and `{total}` left in for the script to fill.
  summary: string;
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
  var rows = Array.from(box.querySelectorAll('li[data-rule]'));
  var min = Number(box.getAttribute('data-min'));
  var tests = {
    length: function (v) { return Array.from(v.normalize('NFC')).length >= min; },
    digit: function (v) { return /\\d/u.test(v); },
    uppercase: function (v) { return /[A-Z]/u.test(v); },
    lowercase: function (v) { return /[a-z]/u.test(v); },
    special: function (v) { return /[^A-Za-z0-9]/u.test(v); }
  };
  var status = box.querySelector('[role=status]');
  var timer;
  function check() {
    return rows.filter(function (row) {
      var ok = tests[row.getAttribute('data-rule')](field.value);
      row.setAttribute('data-met', String(ok));
      return ok;
    }).length;
  }
  field.addEventListener('input', function () {
    var met = check();
    clearTimeout(timer);
    timer = setTimeout(function () {
      status.textContent = box.getAttribute('data-summary').replace('{met}', met).replace('{total}', rows.length);
    }, 800);
  });
  check();
  var toggle = box.querySelector('button');
  toggle.hidden = false;
  toggle.addEventListener('click', function () {
    var show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
  });
})();`;

export interface PasswordHints {
  // The list, the toggle and the script element, each line indented two
  // spaces to sit inside a form, to follow the field's label.
  markup: string;
  // What the page returns, so the policy it is sent with names this script.
  script: PageScript;
  // Attributes for the field itself: the id the script and the label use, the
  // minimum the browser can check, and what keeps a revealed password from a
  // spellchecker, autocorrect or capitals.
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
    markup: `  <div class="rules hint" id="password-rules" data-min="${min}" data-summary="${text.summary}">
    <p class="rules-head"><span>${text.heading}</span> <button type="button" class="quiet" hidden aria-controls="${PASSWORD_FIELD_ID}" aria-pressed="false">${text.show}</button> <span role="status"></span></p>
    <ul id="${PASSWORD_RULES_LIST_ID}">
${lines.map((line) => `      ${line}`).join('\n')}
    </ul>
  </div>
  <script nonce="${nonce}">${PASSWORD_HINTS_SCRIPT}</script>`,
    script: { nonce, fetchesSameOrigin: false },
    field: ` id="${PASSWORD_FIELD_ID}" minlength="${min}" spellcheck="false" autocapitalize="off" autocorrect="off"`,
  };
}
