#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

/**
 * Гейт на обещание «devtools — 0 байт в проде».
 *
 * Обещание держится ровно на одном: код devtools лежит в своём entry, и ни один
 * другой не тянет его ни прямо, ни через общий чанк. Проверка идёт по
 * фактическому графу импортов собранного `dist`, а не по намерению: rolldown
 * сводит разделяемые модули в общие чанки сам, и заметить такое сведение по
 * исходникам нельзя.
 */

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')

const DEVTOOLS_ENTRY = 'devtools.js'
const PRODUCTION_ENTRIES = ['index.js', 'core.js', 'vue.js', 'plugins.js', 'vue-global-types.js']
// Строка есть только в `src/devtools/bridge.ts` и переживает минификацию:
// это ключ в `window`, переименовать его сборщик не может.
const MARKER = '__FINT_I18N_DEVTOOLS__'

function reachable(entry) {
  const seen = new Set()
  const queue = [entry]

  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)

    let source
    try {
      source = readFileSync(join(distDir, file), 'utf8')
    }
    catch {
      continue
    }

    for (const match of source.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
      const specifier = match[1]
      if (!specifier.startsWith('.')) continue

      queue.push(relative(distDir, resolve(distDir, dirname(file), specifier)))
    }
  }

  return seen
}

if (!readdirSync(distDir).includes(DEVTOOLS_ENTRY)) {
  console.error(`✗ dist/${DEVTOOLS_ENTRY} not found — run \`yarn build\` first`)
  process.exit(1)
}

// Без этой проверки гейт был бы пустым: переименуй маркер, и он «пройдёт» на всём.
if (!readFileSync(join(distDir, DEVTOOLS_ENTRY), 'utf8').includes(MARKER)) {
  console.error(`✗ marker "${MARKER}" is gone from dist/${DEVTOOLS_ENTRY}; the check below proves nothing`)
  process.exit(1)
}

let failed = false

for (const entry of PRODUCTION_ENTRIES) {
  const files = [...reachable(entry)]
  const leaking = files.filter((file) => {
    try {
      return readFileSync(join(distDir, file), 'utf8').includes(MARKER)
    }
    catch {
      return false
    }
  })

  if (leaking.length > 0) {
    failed = true
    console.error(`✗ ${entry} reaches devtools code through: ${leaking.join(', ')}`)
  }
  else {
    console.log(`  ✓ ${entry} — ${files.length} file(s), no devtools code`)
  }
}

if (failed) {
  console.error('\nDevtools must stay out of every production entry — see DEVTOOLS-SPEC.md, section 3.')
  process.exit(1)
}

console.log('\nDevtools is isolated from every production entry.')
