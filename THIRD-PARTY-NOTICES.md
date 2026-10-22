# Third-party notices

Material that Odudu ships and that other people wrote. The full licence text
of each item is in [`LICENSES/`](LICENSES/), and the documentation site
publishes the font licences beside the fonts at `/licenses/`.

## Fonts

The admin console, the server's pages and the documentation site serve
IBM Plex Sans and IBM Plex Mono as web fonts, from the `@fontsource` packages
(version 5.3.0, pinned in `apps/admin-console`, `apps/docs` and
`packages/instrument`). Both are licensed under the SIL Open Font License,
Version 1.1.

| Family        | Copyright                | Licence text                                                               |
| ------------- | ------------------------ | -------------------------------------------------------------------------- |
| IBM Plex Sans | Copyright 2019 IBM Corp. | [`LICENSES/OFL-1.1-IBM-Plex-Sans.txt`](LICENSES/OFL-1.1-IBM-Plex-Sans.txt) |
| IBM Plex Mono | Copyright 2017 IBM Corp. | [`LICENSES/OFL-1.1-IBM-Plex-Mono.txt`](LICENSES/OFL-1.1-IBM-Plex-Mono.txt) |

The wordmark in `brand/` is IBM Plex Mono converted to outlines; its licence
text is `brand/LICENSE-IBM-Plex-Mono.txt`.

## Common-password list

A password is refused when it is on a list of common ones, which the server
holds in memory. The list is the entries of eight characters or more among the
first 100,000 lines of `xato-net-10-million-passwords-100000.txt` in
[SecLists](https://github.com/danielmiessler/SecLists), commit
`4c0fd59432ab8508edc23b3c880127edb12e34d5`, lowercased and without duplicates, less three entries a
repository-wide word check refuses:
38,446 entries, in `packages/domain-identity/src/service/common-passwords-data.ts`.
SecLists is licensed under the MIT licence, Copyright (c) 2018 Daniel Miessler;
the licence text is [`LICENSES/MIT-SecLists.txt`](LICENSES/MIT-SecLists.txt).
