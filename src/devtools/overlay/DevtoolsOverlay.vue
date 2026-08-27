<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import type { DevtoolsMode } from '../modes'
import type { DevtoolsEvent, DevtoolsSnapshot, DictionaryEntry, FintI18nDevtools, OverlayOptions } from '../types'

const props = defineProps<{
  devtools: FintI18nDevtools
  position: NonNullable<OverlayOptions['position']>
  collapsed: boolean
}>()

const TABS = ['locales', 'blocks', 'dictionary', 'missing', 'events', 'caches'] as const
type Tab = typeof TABS[number]

const open = ref(!props.collapsed)
const tab = ref<Tab>('blocks')
const filter = ref('')
const snapshot = shallowRef<DevtoolsSnapshot | null>(null)
const events = shallowRef<readonly DevtoolsEvent[]>([])
const dictionary = shallowRef<DictionaryEntry[]>([])

/**
 * Снимок обходит словарь, поэтому пересчитывается не на каждое событие, а раз
 * в микрозадачу: на загрузке блока событий приходит пачка, и панель не должна
 * платить за каждое.
 */
let scheduled = false
function refresh() {
  if (scheduled) return
  scheduled = true

  queueMicrotask(() => {
    scheduled = false
    if (!open.value) return

    try {
      snapshot.value = props.devtools.snapshot()
      events.value = props.devtools.events.slice().reverse()
      dictionary.value = tab.value === 'dictionary' ? props.devtools.dictionary() : []
    }
    catch {
      // Инстанс освобождён — показываем последнее, что успели снять.
      snapshot.value = null
    }
  })
}

const stop = props.devtools.subscribe(refresh)
onScopeDispose(stop)
refresh()

function toggle() {
  open.value = !open.value
  if (open.value) refresh()
}

function select(next: Tab) {
  tab.value = next
  refresh()
}

defineExpose({ toggle })

const counts = computed(() => ({
  locales: snapshot.value?.availableLocales.length ?? 0,
  blocks: snapshot.value?.blocks.length ?? 0,
  dictionary: dictionary.value.length,
  missing: (snapshot.value?.missingKeys.length ?? 0) + (snapshot.value?.fallbacks.length ?? 0),
  events: events.value.length,
  caches: Object.keys(snapshot.value?.compiled ?? {}).length,
}))

const failing = computed(() => snapshot.value?.blocks.filter(block => block.status === 'failed').length ?? 0)

const visibleDictionary = computed(() => {
  const needle = filter.value.trim().toLowerCase()
  const rows = needle
    ? dictionary.value.filter(entry => entry.key.toLowerCase().includes(needle))
    : dictionary.value

  return rows.slice(0, 300)
})

const visibleEvents = computed(() => {
  const needle = filter.value.trim().toLowerCase()
  return needle ? events.value.filter(event => event.type.toLowerCase().includes(needle)) : events.value
})

const locales = computed(() => snapshot.value?.availableLocales ?? [])

function time(at: number): string {
  return new Date(at).toLocaleTimeString()
}

function short(payload: unknown): string {
  if (payload === undefined) return ''
  const text = JSON.stringify(payload)
  return text.length > 160 ? `${text.slice(0, 160)}…` : text
}

function tone(type: string): string {
  if (type === 'error') return 'bad'
  if (type === 'warning' || type === 'retry' || type === 'missingKey') return 'warn'
  return ''
}

const MODES: DevtoolsMode[] = ['off', 'keys', 'pseudo']
const mode = ref<DevtoolsMode>(props.devtools.mode)

function setMode(next: DevtoolsMode) {
  props.devtools.setMode(next)
  mode.value = props.devtools.mode
  refresh()
}

/** Действие бывает асинхронным, поэтому снимок обновляется после него. */
function run(action: () => unknown) {
  void Promise.resolve(action()).then(refresh)
}

function patch(key: string, locale: string, event: Event) {
  props.devtools.actions.patchMessage(locale, key, (event.target as HTMLInputElement).value)
  refresh()
}

function download(payload: unknown, suffix: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')

  link.href = url
  link.download = `fint-i18n-${snapshot.value?.name ?? 'i18n'}-${suffix}.json`
  link.click()

  URL.revokeObjectURL(url)
}

function exportReport() {
  if (!snapshot.value) return

  download({ snapshot: snapshot.value, events: props.devtools.events }, 'report')
}
</script>

<template>
  <div class="root" :class="position">
    <button v-if="!open" class="badge" type="button" @click="toggle">
      <b>i18n</b>
      <span v-if="snapshot">{{ snapshot.locale }}</span>
      <span v-if="failing" class="chip bad">{{ failing }}</span>
    </button>

    <div v-else class="panel">
      <div class="head">
        <span class="title">fint-i18n</span>
        <span class="chip">{{ snapshot?.locale ?? '—' }}</span>
        <span v-if="snapshot?.disposed" class="chip bad">disposed</span>
        <span class="modes">
          <button
            v-for="name in MODES"
            :key="name"
            type="button"
            :class="{ on: mode === name }"
            :title="`t() output mode: ${name}`"
            @click="setMode(name)"
          >
            {{ name }}
          </button>
        </span>
        <span class="spacer" />
        <span class="meta">{{ snapshot?.name }} · v{{ snapshot?.version }}</span>
        <button type="button" title="Export report" @click="exportReport">
          ↓
        </button>
        <button type="button" title="Hide" @click="toggle">
          ✕
        </button>
      </div>

      <div class="tabs">
        <button
          v-for="name in TABS"
          :key="name"
          type="button"
          :class="{ on: tab === name }"
          @click="select(name)"
        >
          {{ name }}<sup>{{ counts[name] }}</sup>
        </button>
      </div>

      <div class="body">
        <template v-if="!snapshot">
          <p class="empty">
            instance released
          </p>
        </template>

        <template v-else-if="tab === 'locales'">
          <div class="actions">
            <button
              v-for="locale in locales"
              :key="locale"
              type="button"
              :class="{ on: locale === snapshot.locale }"
              @click="run(() => devtools.actions.setLocale(locale))"
            >
              {{ locale }}
            </button>
          </div>
          <dl>
            <dt>current</dt><dd>{{ snapshot.locale }}</dd>
            <dt>fallback</dt><dd>{{ snapshot.fallbackLocale || '—' }}</dd>
            <dt>known</dt><dd>{{ snapshot.knownLocales.join(', ') || '—' }}</dd>
            <dt>available</dt><dd>{{ snapshot.availableLocales.join(', ') || '—' }}</dd>
          </dl>
        </template>

        <template v-else-if="tab === 'blocks'">
          <p v-if="!snapshot.blocks.length" class="empty">
            no blocks touched yet
          </p>
          <table v-else>
            <thead>
              <tr><th>block</th><th>locale</th><th>status</th><th>ms</th><th>uses</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="block in snapshot.blocks" :key="`${block.locale}:${block.block}`">
                <td class="key">
                  {{ block.block }}
                  <span v-if="block.resolvedAs" class="chip">via {{ block.resolvedAs }}</span>
                  <div v-if="block.error" class="dim">
                    {{ block.error }}
                  </div>
                </td>
                <td>{{ block.locale }}</td>
                <td>
                  <span
                    class="chip"
                    :class="{ good: block.status === 'loaded', bad: block.status === 'failed', warn: block.status === 'unloaded' }"
                  >{{ block.status }}</span>
                </td>
                <td class="dim">
{{ block.duration ?? '—' }}
</td>
                <td class="dim">
{{ snapshot.usage[block.block] ?? 0 }}
</td>
                <td>
                  <button type="button" title="Reload" @click="run(() => devtools.actions.reloadBlock(block.block, block.locale))">
                    ↻
                  </button>
                  <button type="button" title="Unload" @click="run(() => devtools.actions.unloadBlock(block.resolvedAs ?? block.block, block.locale))">
                    ⌫
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else-if="tab === 'dictionary'">
          <input v-model="filter" type="search" placeholder="filter keys…">
          <p v-if="!visibleDictionary.length" class="empty">
            nothing loaded yet
          </p>
          <table v-else>
            <thead>
              <tr>
<th>key</th><th v-for="locale in locales" :key="locale">
{{ locale }}
</th>
</tr>
            </thead>
            <tbody>
              <tr v-for="entry in visibleDictionary" :key="entry.key">
                <td class="key">
{{ entry.key }}
</td>
                <td v-for="locale in locales" :key="locale" class="locale-cell" :class="{ dim: !entry.values[locale] }">
                  <input
                    v-if="entry.editable"
                    class="edit"
                    :value="entry.values[locale] ?? ''"
                    :placeholder="`add to ${locale}`"
                    @change="patch(entry.key, locale, $event)"
                  >
                  <template v-else>
                    {{ entry.values[locale] ?? '—' }}
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else-if="tab === 'missing'">
          <div v-if="snapshot.missingKeys.length" class="actions">
            <button type="button" @click="download(devtools.actions.missingKeysPatch(), 'missing')">
              export dictionary patch
            </button>
          </div>
          <p v-if="!snapshot.missingKeys.length && !snapshot.fallbacks.length" class="empty">
            no misses so far
          </p>
          <table v-else>
            <thead>
              <tr><th>key</th><th>locale</th><th>kind</th><th>×</th></tr>
            </thead>
            <tbody>
              <tr v-for="miss in snapshot.missingKeys" :key="`m:${miss.locale}:${miss.key}`">
                <td class="key">
{{ miss.key }}
</td>
                <td>{{ miss.locale }}</td>
                <td><span class="chip bad">missing</span></td>
                <td class="dim">
{{ miss.count }}
</td>
              </tr>
              <tr v-for="hit in snapshot.fallbacks" :key="`f:${hit.locale}:${hit.key}`">
                <td class="key">
{{ hit.key }}
</td>
                <td>{{ hit.locale }}</td>
                <td><span class="chip warn">from {{ hit.fallbackLocale }}</span></td>
                <td class="dim">
{{ hit.count }}
</td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else-if="tab === 'events'">
          <input v-model="filter" type="search" placeholder="filter by type…">
          <p v-if="!visibleEvents.length" class="empty">
            timeline is empty
          </p>
          <div v-for="event in visibleEvents" v-else :key="event.id" class="event" :class="tone(event.type)">
            <span class="at">{{ time(event.at) }}</span>
            <span class="type">{{ event.type }}</span>
            <span class="payload">{{ short(event.payload) }}</span>
          </div>
        </template>

        <template v-else>
          <div class="actions">
            <button type="button" @click="run(() => devtools.actions.clearCompiled())">
              clear compiled
            </button>
            <button type="button" @click="run(() => devtools.actions.clearFormatterCache())">
              clear Intl formatters
            </button>
            <button type="button" @click="run(() => devtools.actions.clearPluralCache())">
              clear plural rules
            </button>
          </div>
          <dl>
            <dt>compiled</dt>
            <dd>
              <template v-for="(count, locale) in snapshot.compiled ?? {}" :key="locale">
                {{ locale }}: {{ count }}&nbsp;
              </template>
              <span v-if="!snapshot.compiled">unavailable</span>
            </dd>
            <dt>registered</dt>
            <dd>{{ snapshot.registeredBlocks?.join(', ') ?? 'unavailable' }}</dd>
            <dt>plugins</dt>
            <dd>{{ snapshot.plugins?.join(', ') ?? 'unavailable' }}</dd>
            <dt>preloadFallback</dt>
            <dd>{{ snapshot.options?.preloadFallback ?? '—' }}</dd>
            <dt>unloadUnused</dt>
            <dd>{{ snapshot.options?.unloadUnusedBlocks ?? '—' }}</dd>
            <dt>retry</dt>
            <dd>{{ snapshot.options?.retry ? JSON.stringify(snapshot.options.retry) : 'off' }}</dd>
          </dl>
          <p class="empty">
            Intl and plural warnings stay in the console — their caches never reach an instance.
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
