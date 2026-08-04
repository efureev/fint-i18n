import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

/**
 * Гейт на размер публикуемых артефактов. Собственный скрипт, а не size-limit:
 * рантайм-зависимостей у пакета нет, и заводить devDependency ради сложения
 * двух чисел незачем.
 *
 * Бюджеты живут в `size-budget.json` и правятся осознанно, вместе с тем
 * изменением, которое их сдвинуло.
 */
const budgets = JSON.parse(readFileSync(new URL('../size-budget.json', import.meta.url), 'utf8'))
const distDir = new URL('../dist/', import.meta.url)

function collect(dir, prefix = '') {
  const out = new Map()
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      for (const [name, size] of collect(path, `${prefix}${entry}/`)) out.set(name, size)
      continue
    }
    if (!entry.endsWith('.js')) continue
    out.set(`${prefix}${entry}`, gzipSync(readFileSync(path), { level: 9 }).length)
  }
  return out
}

const files = collect(new URL(distDir).pathname)

// Чанки получают хеш в имени, поэтому бюджет задаётся по префиксу.
function match(pattern) {
  let total = 0
  let found = false
  for (const [name, size] of files) {
    if (name === pattern || name.startsWith(pattern)) {
      total += size
      found = true
    }
  }
  return found ? total : null
}

let failed = false
console.log('Bundle size (gzip -9)\n')

for (const [pattern, budget] of Object.entries(budgets.entries)) {
  const size = match(pattern)

  if (size === null) {
    console.log(`  ✗ ${pattern.padEnd(28)} not found in dist/`)
    failed = true
    continue
  }

  const delta = size - budget
  const ratio = ((delta / budget) * 100).toFixed(1)
  const over = delta > 0

  console.log(`  ${over ? '✗' : '✓'} ${pattern.padEnd(28)} ${String(size).padStart(6)} B  budget ${String(budget).padStart(6)} B  ${over ? '+' : ''}${ratio}%`)
  if (over) failed = true
}

if (failed) {
  console.error('\nBundle grew past its budget. Justify the change and update size-budget.json in the same commit.')
  process.exit(1)
}

console.log('\nAll entries within budget.')
