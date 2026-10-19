export function renderAttributes(): string {
  return `<img src="/x.svg" alt="Company logo">
<a href="/x" title="Open the page">go</a>
<input type="text" placeholder="Your name">
<div aria-label="Close dialog"></div>
<button type="submit" name="decision" value="allow">${"x"}</button>
<input type="submit" value="Send now">`;
}
