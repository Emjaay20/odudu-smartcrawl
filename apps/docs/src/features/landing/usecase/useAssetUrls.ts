import useBaseUrl from '@docusaurus/useBaseUrl';

export interface AssetUrls {
  readonly llms: string;
  readonly sansLicence: string;
  readonly monoLicence: string;
}

// The files the page links that the build publishes beside it.
export function useAssetUrls(): AssetUrls {
  return {
    llms: useBaseUrl('/llms.txt'),
    sansLicence: useBaseUrl('/licenses/IBM-Plex-Sans-OFL-1.1.txt'),
    monoLicence: useBaseUrl('/licenses/IBM-Plex-Mono-OFL-1.1.txt'),
  };
}
