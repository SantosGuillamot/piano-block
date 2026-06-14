# Add a command to build a distribution-ready plugin zip

> Source: GitHub issue [#40](https://github.com/SantosGuillamot/piano-block/issues/40).
> This file is self-contained; agents do not need to open the source issue.

## Goal

A maintainer can produce a distributable plugin zip that contains only the files needed to run the Piano Block plugin in WordPress — excluding development/source files, config, and tooling — without manually selecting files.

## Assumptions / directions to explore

- The wp-movies-demo build script (`https://github.com/WordPress/wp-movies-demo/blob/main/.github/scripts/build-plugin.js`) is offered as **one possible approach, not a requirement**. It is a small Node.js script that packages an _allowlisted_ set of directories and files (e.g. `build/`, `src/`, `vendor/`, plus the main plugin PHP file and README) into a zip via the `archiver` library. Alternatives such as `wp-scripts plugin-zip` or a WP-CLI-native route are open for the agents to evaluate and may be adopted, adapted, or replaced. _(open — to be confirmed in later phases)_
