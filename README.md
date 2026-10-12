# LibKa Guard

A GitHub Action that builds [LibKa](https://github.com/aivigator-ai/open-libka-design-platform) documents and checks every output before anything is merged: axe-core with the WCAG 2.2 A and AA rules, the contrast of every text (4.5:1, and 7:1 when the reader asks for more contrast), LibKa's structure rules, PDF/UA-1 by veraPDF when it is installed, and the Word file's structure. Outputs that pass are signed. Any finding fails the job, is marked on its line in the pull request, and is listed in the job summary.

## Use it

```yaml
name: documents
on: [push, pull_request]
permissions:
  contents: read
jobs:
  guard:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@<commit> # pin to a commit
      - uses: aivigator-ai/open-libka-guard-action@<commit> # vX.Y.Z
        with:
          documents: |
            docs/*.md
            guides/**/*.md
```

GitHub's Ubuntu and Windows runners come with Google Chrome, which LibKa needs. Without Java and veraPDF on the runner, PDFs are still built, and their manifest and conformance report say the PDF was not validated against PDF/UA.

## Inputs

| Input | What it does | Default |
|---|---|---|
| `documents` | LibKa documents to build and check, one path or glob per line. Each gets the outputs its front matter asks for | |
| `pages` | Finished HTML pages to check only (`libka check`), one path or glob per line | |
| `outputs` | Replaces each document's outputs for this run, such as `web,pdf` | the document's own |
| `cli` | The LibKa command line, as npm installs it | `@libka/cli` at this action's version |
| `working-directory` | Where the paths are relative to | `.` |

## Outputs

`checked`: how many documents and pages were checked; `failed`: how many failed.

## Licence

Apache License 2.0, like LibKa.
