async function tabTo(press: (key: string) => Promise<void>) {
  for (let step = 0; step < 80; step += 1) await press('Tab');
}
export { tabTo };
