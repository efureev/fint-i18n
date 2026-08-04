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

Current scenarios in `bench/core.bench.ts` — the cost of a single call:

- Cold compile for `compileTemplate()` and `compilePluralForms()`.
- Steady-state translation via `i18n.t()` after cache warmup, plain and plural.
- Nested lookup for an already compiled key.
- `n()` / `d()` with a cached formatter, against constructing `Intl.NumberFormat`.
- `setLocale()` with already registered used blocks.

`bench/dictionary.bench.ts` answers a different question — throughput on a dictionary
the size of a real application: 5 000 keys across 50 blocks, accessed out of order so
the run does not flatter the CPU cache. It reports three things: a warm pass over every
key, a cold first pass (instance + merge + compiling each message), and `mergeMessages()`
on its own, which is what the other two are measured against.

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

## What the Package Costs a Consumer

```bash
yarn --cwd fint-i18n build && yarn --cwd fint-i18n size:consumer
```

`scripts/check-size.mjs` and `scripts/consumer-size.mjs` measure two different things, and
the difference matters:

- **`size:check`** — the size of the shipped `dist` chunks, gated by `size-budget.json`.
  This is the artifact, not the price: a consumer who imports half the API bundles less
  than the chunk weighs.
- **`size:consumer`** — what actually lands in an application. Each scenario is built as a
  separate bundle over `dist` with `vue` external, then gzipped. The scenarios *use* what
  they import; a re-export (`export * from`) would retain the whole module surface and
  measure the chunk again.

The numbers in the README come from the second one. Both are only comparable between runs
on the same machine.

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
