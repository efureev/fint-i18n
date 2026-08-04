# Tooling for dictionaries

The package ships two command-line tools. They are not part of the runtime — they
are not imported by your application and add nothing to your bundle. They exist
because dictionaries are the one part of an i18n setup that the type system never
sees: a key you renamed in code and forgot in `ru.json` compiles fine and fails in
front of a user.

| Tool | Answers |
| --- | --- |
| `fint-i18n-check-messages` | Do the locales still agree with each other and with the code? |
| `fint-i18n-codemod-plurals` | Migrating dictionaries from the `\|` plural syntax of 0.4.0 to the form objects of 0.5.0 |

## Running them

Both are exposed as `bin` entries, so no install step is needed in a project that
already depends on the package:

```bash
npx fint-i18n-check-messages src/i18n/locales --source src
npx fint-i18n-codemod-plurals src/i18n/locales
```

Inside this repository they are also plain scripts:

```bash
yarn check:messages                              # the playground dictionaries
node scripts/check-messages.mjs <locales dir>    # anything else
```

The dictionary checks work with Node alone. The **code** checks (`--source`)
additionally need `typescript`, and `@vue/compiler-sfc` if you have `.vue` files.
Neither is a dependency of this package — an application that has `.ts` and `.vue`
files already has both, and pulling a compiler into a runtime i18n library to
check dictionaries would be the wrong trade. If one is missing, the tool names it
instead of failing with a module stack.

## `fint-i18n-check-messages`

```
fint-i18n-check-messages <locales dir> [--source <dir>]… [--allow <key>]… [--strict]
```

The locales directory is either `<locale>/*.json` (nested folders become dotted
block names: `widgets/alpha.json` → `widgets.alpha`) or a flat `<locale>.json`.

### Locale parity

Every key must exist in every locale. This is the check that catches the
translation added to `en` on Friday and never mirrored into `ru`.

Deliberate asymmetry — a key that genuinely belongs to one locale only — is
declared, not ignored:

```bash
npx fint-i18n-check-messages src/i18n/locales --allow legal.usDisclaimer
```

Different CLDR category sets are **not** a divergence. `en` having `{one, other}`
where `ru` has `{one, few, many, other}` for the same key is correct, and the
checker treats a set of plural forms as a single key rather than one key per form.

### Plural completeness

A set of forms must cover every category its locale actually uses. A Russian
message with only `one` and `other` renders the wrong noun for 2, 3, 22, 104 — and
nothing in the runtime can report that, because a form set with a missing category
silently falls back.

```
✗ incomplete plural form sets (1):
    ru: cart.items — missing forms: few, many
```

Exact-value keys (`=0`, `=1`) do not count towards coverage and do not break it.

### Key usage

With at least one `--source`, the tool parses your code and compares the keys it
finds against the dictionaries. Two lists come out of it.

**Keys used in code but missing from the dictionaries** are an error. Parsing goes
through the TypeScript AST and `@vue/compiler-sfc`, not regular expressions, so a
`t('…')` in a comment or inside a string literal is not mistaken for a call. It
understands:

- `t()`, `te()`, `tm()` and `$t()`, wherever the callee lands (`i18n.t`, `scope.t`);
- `v-t="'key'"` and `v-t="{ path: 'key' }"`;
- keys relative to a prefixed scope — after
  `useI18nScope(['profile'], { prefix: true })`, a `t('title')` in that file is
  checked as both `title` and `profile.title`, and passes if either exists.

**Keys present in the dictionaries but not found in code** are a report, not an
error, and are printed with `?`. The tool cannot see a key assembled at runtime, so
a clean-looking "unused" list is a hint to read, not a list to delete from. Any
dynamic key it encountered is listed underneath precisely so you can judge how
complete the list is:

```
! keys assembled dynamically (2) — the unused list is incomplete because of them:
    src/components/Widget.vue: t(`widgets.${id}.title`…)
```

`tm('common.menu')` marks the whole subtree as used, which is the point of `tm()`:
the component does not name the individual keys.

Pass `--strict` to make unused keys fail as well — reasonable once you have no
dynamic keys left, and misleading before that.

### Exit codes and CI

`0` — everything checked passed. `1` — a check failed, or the arguments were
unusable. That is all a CI step needs:

```yaml
- name: Check messages
  run: npx fint-i18n-check-messages src/i18n/locales --source src
```

In this repository the same step runs as `yarn check:messages`, before the tests.

### What it cannot know

Worth stating plainly, because a checker trusted beyond its reach is worse than no
checker:

- a key built from a variable is invisible — it is reported, not resolved;
- messages merged at runtime via `mergeMessages()` are not in any JSON file, so
  keys pointing at them read as "missing" and need `--allow`;
- it reads JSON only. Dictionaries defined in `.ts` are outside its scope.

## `fint-i18n-codemod-plurals`

```
fint-i18n-codemod-plurals <paths…> [--write] [--locale=ru] [--positional]
```

Before 0.5.0, plural branches were written inside the message string, separated by
`|`. From 0.5.0 a message string has no special characters at all and plurals are
an object of forms. This tool performs the migration.

Without `--write` it is a dry run: it prints what it would do and touches nothing.

The locale is taken from the file name (`ru.json`) or its parent folder
(`locales/ru/common.json`), and from nowhere else — the path is not scanned as a
whole, because `Intl` accepts almost any two or three letters as a structurally
valid tag, which would quietly turn a `lib` or `tmp` segment into a locale. Use
`--locale=` when the layout does not carry it.

### Converted automatically

Strings whose branches are labelled, where the author's intent is unambiguous:

```jsonc
// before
{ "files": "one: {n} file | other: {n} files" }
// after
{ "files": { "one": "{n} file", "other": "{n} files" } }
```

Exact-value labels (`=0:`) are kept and ordered before the named categories. If the
resulting set does not cover the locale's categories, the tool says so — it
converts, and warns, rather than inventing a form.

### Left to a human

Unlabelled branches are **not** converted, and this is the tool's central decision.
In the 0.4.0 syntax, `"Name | Email"` and `"{n} file | {n} files"` are the same
shape. Guessing between them is exactly what made the old syntax dangerous, so the
codemod refuses to guess and reports instead:

```
? table.header  [positional]
    "Name | Email"
    Looks like ordinary text: 2 branches, "en" has 2 categories, no counter
    placeholder. Most likely leave as is.
```

Where the string does look like plural forms — a `{n}`/`{count}` placeholder, or a
branch count matching the locale's category count — a ready-made object is offered
for you to paste. `--positional` accepts all of those suggestions in bulk; use it
only after reading the dry run.

Two more cases are reported rather than converted: partially labelled branches
(the unlabelled ones were unreachable in 0.4.0, so the intent has to be
reconstructed) and strings containing `||`, which used to render as a single `|`
and now renders as two.

### After the migration

Run the checker over the result. The codemod converts what it can prove; the
checker tells you whether the outcome is complete:

```bash
npx fint-i18n-codemod-plurals src/i18n/locales --write
npx fint-i18n-check-messages src/i18n/locales --source src
```
