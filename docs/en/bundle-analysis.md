# Benchmarks and Bundle Analysis

The package includes two separate tools:

- Runtime benchmarks for key `fint-i18n` hot paths.
- Bundle analysis to understand the composition of the built `dist`.

## Runtime Benchmarks

To run:

```bash
yarn --cwd fint-i18n bench
```

What the command does:

- Runs benchmark files from `bench/**/*.bench.ts` via `vitest bench`.
- Saves machine-readable results to `dist/analysis/bench-results.json`.
- Prints `ops/sec` for each scenario to the console.

Current scenarios in `bench/core.bench.ts`:

- Cold compile for `compileTemplate()`.
- Steady-state translation via `i18n.t()` after cache warmup.
- Nested lookup for an already compiled key.
- `setLocale()` with already registered used blocks.

What the console output means:

- `name` — Name of the benchmark scenario.
- `hz` / `ops/sec` — Operations per second; higher is faster.
- `min`, `max`, `mean` — Minimum, maximum, and average time for a single operation in milliseconds; lower is better.
- `p75`, `p99`, `p995`, `p999` — Execution time percentiles; showing how expensive the "tails" are.
- `rme` — Relative margin of error; lower means more stable results.
- `samples` — Number of measurements collected for statistical calculation.

Important:

- Results should only be compared between runs on the same machine under similar conditions.
- This is not a microbenchmark of the entire Node runtime, but applied scenarios for `fint-i18n` itself.

## Bundle Composition Analysis

To run:

```bash
yarn --cwd fint-i18n build:analyze
```

What the command does:

- Builds the library as usual.
- Enables `rollup-plugin-visualizer` only during analysis.
- Places reports in `dist/analysis/`.

Artifacts:

- `dist/analysis/stats.html` — Interactive treemap.
- `dist/analysis/stats.md` — Text summary for reading and code review.
- `dist/analysis/stats.json` — Raw data report for automated processing or comparison.

How to read the reports:

- `stats.html` helps quickly see which modules and chunks take up the most space.
- `stats.md` is convenient for use in PRs or local audits when a text summary is needed.
- `stats.json` is useful for subsequent machine analysis or custom scripts.

## Usage Practice

Minimum cycle after changing the runtime:

```bash
yarn --cwd fint-i18n bench
yarn --cwd fint-i18n build:analyze
```

This answers two different questions:

- Has the performance of the hot path degraded?
- Has the composition/size of the built bundle increased without reason?
