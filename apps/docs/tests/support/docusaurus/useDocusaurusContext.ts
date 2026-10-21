export default function useDocusaurusContext(): {
  readonly siteConfig: {
    readonly url: string;
    readonly baseUrl: string;
    readonly customFields: Record<string, unknown>;
  };
} {
  return {
    siteConfig: {
      url: 'https://example.test',
      baseUrl: '/odudu/',
      customFields: { docsRoute: 'docs/' },
    },
  };
}
