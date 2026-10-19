export function renderScript(): string {
  return `<p>${'x'}</p>
<script nonce="n">
const failure = document.getElementById('failure');
failure.textContent = 'Something went wrong';
</script>`;
}
