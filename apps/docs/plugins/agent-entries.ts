export interface ListedPage {
  title: string;
  url: string;
}

const ENTRY = /^- \[(.+)\]\((\S+?)\)(?::|$)/u;

export function parseEntries(llmsTxt: string): ListedPage[] {
  return llmsTxt.split('\n').flatMap((line) => {
    const match = ENTRY.exec(line);
    return match?.[1] === undefined || match[2] === undefined
      ? []
      : [{ title: match[1], url: match[2] }];
  });
}
