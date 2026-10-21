export default function useDocusaurusContext(): {
  readonly siteConfig: { readonly url: string; readonly baseUrl: string };
} {
  return { siteConfig: { url: 'https://example.test', baseUrl: '/odudu/' } };
}
