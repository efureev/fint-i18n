<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue'
import {
  anchorFrom,
  clampPosition,
  MIN_H,
  MIN_W,
  clampSize,
  clearLayout,
  isUsableViewport,
  readLayout,
  resolveStorage,
  toPosition,
  willSnap,
  writeLayout,
  type Anchor,
  type Size,
} from './layout'
import type { MetricsSnapshot } from '../metrics'
import type { DevtoolsMode } from '../modes'
import type { DevtoolsEvent, DevtoolsSnapshot, DictionaryEntry, FintI18nDevtools, OverlayOptions } from '../types'
import type { PanelI18n } from './i18n'

const props = defineProps<{
  devtools: FintI18nDevtools
  position: NonNullable<OverlayOptions['position']>
  collapsed: boolean
  storage?: Storage | false
  i18n: PanelI18n
  followLocale: boolean
}>()

/** Подписи панели, а не приложения: инстанс у них разный и намеренно. */
const t = props.i18n.t

const TABS = ['locales', 'blocks', 'dictionary', 'missing', 'events', 'metrics', 'caches'] as const
type Tab = typeof TABS[number]

const open = ref(!props.collapsed)
const tab = ref<Tab>('blocks')
const filter = ref('')
const snapshot = shallowRef<DevtoolsSnapshot | null>(null)
const events = shallowRef<readonly DevtoolsEvent[]>([])
const dictionary = shallowRef<DictionaryEntry[]>([])
const metrics = shallowRef<MetricsSnapshot | null>(null)
const SAMPLING = [1, 10, 100]
/**
 * Потолок строк в таблице словаря. Он нужен: тысячи полей ввода в теневом дереве
 * кладут панель. Но молча обрезанный список хуже обрезанного явно, поэтому
 * рядом всегда видно полное число.
 */
const DICTIONARY_LIMIT = 1000
/**
 * Счётчики растут без единого события ленты, поэтому вкладка метрик — единственная,
 * которую приходится опрашивать. Раз в полсекунды: чаще незачем, а подписываться
 * на каждый перевод значило бы перерисовывать панель чаще, чем страницу.
 */
const METRICS_POLL_MS = 500

const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const storage = resolveStorage(props.storage)
/** Пока `false`, панель держится за угол из опций; после — за свои `left`/`top`. */
const pinned = ref(false)
/** Подсветка на время перетаскивания: показывает, что на отпускании прилипнет. */
const snapping = ref(false)

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight })

const sizeOf = (): Size => {
  const rect = panel.value?.getBoundingClientRect()

  return { w: rect?.width ?? 0, h: rect?.height ?? 0 }
}

/** Единственное место, которое двигает панель: и перетаскивание, и восстановление. */
function place(x: number, y: number) {
  if (!root.value) return

  const safe = clampPosition(x, y, sizeOf(), viewport())

  root.value.style.left = `${safe.x}px`
  root.value.style.top = `${safe.y}px`
  pinned.value = true
}

/**
 * Пришпиливание к `left`/`top` по измеренному месту. Без него нативный `resize`
 * у прижатой к правому нижнему углу панели растил бы её влево, а ручка стояла бы
 * на месте. В окружении без раскладки (прогон тестов) измерение даёт нули —
 * тогда остаёмся на угловом классе.
 */
function pin() {
  if (pinned.value || !root.value || !panel.value) return

  const rect = panel.value.getBoundingClientRect()
  if (rect.width === 0) return

  place(rect.left, rect.top)
}

function currentPosition(): { x: number, y: number } {
  const rect = root.value?.getBoundingClientRect()

  return {
    x: Number.parseFloat(root.value?.style.left ?? '') || rect?.left || 0,
    y: Number.parseFloat(root.value?.style.top ?? '') || rect?.top || 0,
  }
}

function applyAnchor(anchor: Anchor) {
  const { x, y } = toPosition(anchor, sizeOf(), viewport())

  place(x, y)
}

let dragging: { pointerX: number, pointerY: number, x: number, y: number } | null = null

function onPointerMove(event: PointerEvent) {
  if (!dragging) return

  const x = dragging.x + event.clientX - dragging.pointerX
  const y = dragging.y + event.clientY - dragging.pointerY

  place(x, y)
  snapping.value = willSnap(x, y, sizeOf(), viewport())
}

function onPointerUp() {
  if (!dragging) return

  dragging = null
  snapping.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)

  // Прилипание — здесь, а не на каждом шаге: магнит под курсором мешает ставить
  // панель точно, а на отпускании он ощущается как помощь.
  const { x, y } = currentPosition()
  const anchor = anchorFrom(x, y, sizeOf(), viewport())

  applyAnchor(anchor)
  writeLayout(storage, { anchor })
}

function startDrag(event: PointerEvent) {
  // В шапке живут кнопки режимов, экспорт и закрытие — по ним таскать нельзя.
  if ((event.target as HTMLElement).closest('button, input')) return
  if (!root.value) return

  pin()

  const position = currentPosition()
  dragging = { pointerX: event.clientX, pointerY: event.clientY, x: position.x, y: position.y }

  event.preventDefault()
  // Слушаем окно, а не элемент: `setPointerCapture` есть не везде, а указатель
  // при быстром движении уходит за пределы шапки.
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

let resizing: { pointerX: number, pointerY: number, w: number, h: number } | null = null

/** В окружении без раскладки (прогон тестов) измерение даёт нули — берём инлайн. */
function currentSize(): Size {
  const rect = panel.value?.getBoundingClientRect()

  return {
    w: Math.round(rect?.width ?? 0) || Number.parseFloat(panel.value?.style.width ?? '') || MIN_W,
    h: Math.round(rect?.height ?? 0) || Number.parseFloat(panel.value?.style.height ?? '') || MIN_H,
  }
}

/**
 * Растягивание своё, хотя CSS `resize: both` дал бы его даром. Нативная ручка
 * считает размер как «размер на старте плюс полное смещение курсора» и, упершись
 * в `min-*`, продолжает уводить инлайновое значение за упор: уехав на 240px ниже
 * минимума, обратный ход внутри того же жеста мёртв ровно на эти 240px. Правкой
 * инлайна по ходу это не лечится — следующее движение пересчитывает всё от
 * размера на старте и коррекцию затирает. Здесь шаг применяется к уже
 * ограниченному размеру, поэтому упор отпускает с первого пикселя назад.
 */
function startResize(event: PointerEvent) {
  if (!panel.value) return

  resizing = { pointerX: event.clientX, pointerY: event.clientY, ...currentSize() }

  event.preventDefault()
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeUp)
}

function onResizeMove(event: PointerEvent) {
  if (!resizing || !panel.value) return

  const size = clampSize({
    w: resizing.w + event.clientX - resizing.pointerX,
    h: resizing.h + event.clientY - resizing.pointerY,
  }, viewport())

  resizing = { pointerX: event.clientX, pointerY: event.clientY, ...size }
  panel.value.style.width = `${size.w}px`
  panel.value.style.height = `${size.h}px`
}

function onResizeUp() {
  if (!resizing) return

  const size = { w: resizing.w, h: resizing.h }

  resizing = null
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)

  writeLayout(storage, { size })
  keepInside()
}

/**
 * Выросшая панель могла уехать за край окна, а вместе с ней и ручка в её углу —
 * растягивать становится нечем, и со стороны это тот же «жест перестал работать».
 */
function keepInside() {
  if (!pinned.value) return

  const { x, y } = currentPosition()

  place(x, y)
}

/** Снять инлайновое положение — дальше место определяет угловой класс. */
function unpin() {
  if (root.value) {
    root.value.style.left = ''
    root.value.style.top = ''
  }

  pinned.value = false
}

function resetLayout() {
  unpin()

  if (panel.value) {
    panel.value.style.width = ''
    panel.value.style.height = ''
  }

  clearLayout(storage)
}

function applyStored() {
  const stored = readLayout(storage)

  if (stored?.size && panel.value) {
    const size = clampSize(stored.size, viewport())

    panel.value.style.width = `${size.w}px`
    panel.value.style.height = `${size.h}px`
  }

  return stored
}

/**
 * Окно изменилось — панель идёт за своим краем. Ради этого положение и хранится
 * привязкой, а не координатами: у прижатой к правому краю отступ до него
 * постоянен, и она едет вместе с ним.
 */
function followViewport() {
  // Свёрнутое окно отдаёт нулевые размеры: пересчёт по ним записал бы в панель
  // координаты и размеры, которых не бывает, и она осталась бы такой уже после
  // разворачивания.
  if (!pinned.value || !isUsableViewport(viewport())) return

  const stored = applyStored()

  if (stored?.anchor) applyAnchor(stored.anchor)
  else keepInside()
}

window.addEventListener('resize', followViewport)
onScopeDispose(() => {
  window.removeEventListener('resize', followViewport)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
})

// Восстановление ждёт появления панели в DOM: до него измерять и красить нечего.
watch(open, (isOpen) => {
  // Свёрнутый значок садится в угол из опций и хранимое положение игнорирует.
  // Оно посчитано для панели: у привязки к нижнему или правому краю координата
  // выводится из её размера, которого у значка нет, — и он уезжал под край
  // окна, откуда его было уже не достать.
  if (!isOpen) {
    unpin()
    return
  }

  void nextTick(() => {
    const stored = applyStored()

    if (stored?.anchor) applyAnchor(stored.anchor)
    else pin()
  })
}, { immediate: true })

const simulation = ref({ delay: 0, failPercent: 0, failAttempts: 0 })
const simulating = ref(false)
const onDisk = ref(false)
const written = ref('')

void props.devtools.devServer.probe().then((ready) => { onDisk.value = ready })

/**
 * Правка уезжает и в память, и на диск. Записывать молча правильнее, чем
 * заводить вторую кнопку: правка в словаре — уже осознанное действие, а
 * несохранённая правка теряется при первом же перезапуске.
 */
function persist(patch: Record<string, any>, overwrite: boolean) {
  if (!onDisk.value) return

  void props.devtools.devServer.write(patch, { overwrite })
    .then((files) => { written.value = `wrote ${files.length} file(s)` })
    .catch((error: Error) => { written.value = error.message })
}

function toggleSimulation() {
  if (simulating.value) {
    props.devtools.simulator.stop()
  }
  else {
    props.devtools.simulator.start({
      delay: simulation.value.delay || undefined,
      failureRate: simulation.value.failPercent ? simulation.value.failPercent / 100 : undefined,
      failAttempts: simulation.value.failAttempts || undefined,
    })
  }

  refresh()
}
let poll: ReturnType<typeof setInterval> | undefined

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
      if (props.followLocale) props.i18n.follow(snapshot.value.locale)
      events.value = props.devtools.events.slice().reverse()
      dictionary.value = tab.value === 'dictionary' ? props.devtools.dictionary() : []
      metrics.value = tab.value === 'metrics' ? props.devtools.metrics.snapshot() : null
      // Симулятор живёт на devtools, а не на панели: перемонтирование панели
      // (HMR, повторный вызов `mountDevtoolsOverlay`) его не выключает, и
      // кнопка обязана показывать его состояние, а не своё.
      simulating.value = props.devtools.simulator.active
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

/**
 * Сбор метрик живёт ровно столько, сколько открыта вкладка: подписка на
 * `onTranslate` стоит около 17 % к каждому переводу, и держать её «на всякий
 * случай» — плата ни за что.
 */
function stopMetrics() {
  clearInterval(poll)
  poll = undefined
  props.devtools.metrics.disable()
}

function select(next: Tab) {
  if (next === 'metrics') {
    props.devtools.metrics.enable()
    poll ??= setInterval(refresh, METRICS_POLL_MS)
  }
  else if (tab.value === 'metrics') {
    stopMetrics()
  }

  tab.value = next
  refresh()
}

function sample(rate: number) {
  props.devtools.metrics.disable()
  props.devtools.metrics.enable({ sampling: rate })
  refresh()
}

onScopeDispose(() => {
  if (tab.value === 'metrics') stopMetrics()
})

defineExpose({ toggle })

const counts = computed(() => ({
  locales: snapshot.value?.availableLocales.length ?? 0,
  blocks: snapshot.value?.blocks.length ?? 0,
  dictionary: dictionary.value.length,
  missing: (snapshot.value?.missingKeys.length ?? 0) + (snapshot.value?.fallbacks.length ?? 0),
  events: events.value.length,
  metrics: metrics.value?.calls ?? 0,
  caches: Object.keys(snapshot.value?.compiled ?? {}).length,
}))

const failing = computed(() => snapshot.value?.blocks.filter(block => block.status === 'failed').length ?? 0)

const visibleDictionary = computed(() => {
  const needle = filter.value.trim().toLowerCase()
  const rows = needle
    ? dictionary.value.filter(entry => entry.key.toLowerCase().includes(needle))
    : dictionary.value

  return rows.slice(0, DICTIONARY_LIMIT)
})

/** Полное число строк — чтобы обрезка была видна, а не угадывалась. */
const dictionaryTotal = computed(() => {
  const needle = filter.value.trim().toLowerCase()

  return needle
    ? dictionary.value.filter(entry => entry.key.toLowerCase().includes(needle)).length
    : dictionary.value.length
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
  const value = (event.target as HTMLInputElement).value

  props.devtools.actions.patchMessage(locale, key, value)
  persist({ [locale]: nest(key, value) }, true)
  refresh()
}

/** `common.hello` + значение → `{ common: { hello: значение } }`. */
function nest(key: string, value: string): Record<string, any> {
  const path = key.split('.')
  const tree: Record<string, any> = {}
  let node = tree

  for (let i = 0; i < path.length - 1; i++) {
    node[path[i]] = {}
    node = node[path[i]]
  }
  node[path[path.length - 1]] = value

  return tree
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
  <div ref="root" class="root" :class="{ [position]: !pinned }">
    <button v-if="!open" class="badge" type="button" @click="toggle">
      <b>i18n</b>
      <span v-if="snapshot">{{ snapshot.locale }}</span>
      <span v-if="failing" class="chip bad">{{ failing }}</span>
    </button>

    <div v-else ref="panel" class="panel" :class="{ snapping }">
      <div
        class="head"
        :title="t('head.hint')"
        @pointerdown="startDrag"
        @dblclick="resetLayout"
      >
        <span class="title">fint-i18n</span>
        <span class="chip">{{ snapshot?.locale ?? '—' }}</span>
        <span v-if="snapshot?.disposed" class="chip bad">{{ t('head.disposed') }}</span>
        <span v-if="onDisk" class="chip good" :title="t('head.diskHint')">{{ t('head.disk') }}</span>
        <span class="modes">
          <button
            v-for="name in MODES"
            :key="name"
            type="button"
            :class="{ on: mode === name }"
            :title="t('head.mode', { mode: name })"
            @click="setMode(name)"
          >
            {{ name }}
          </button>
        </span>
        <span class="spacer" />
        <span class="meta">{{ snapshot?.name }} · v{{ snapshot?.version }}</span>
        <button type="button" :title="t('head.export')" @click="exportReport">
          ↓
        </button>
        <button type="button" :title="t('head.hide')" @click="toggle">
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
          {{ t(`tabs.${name}`) }}<sup>{{ counts[name] }}</sup>
        </button>
      </div>

      <div class="body">
        <template v-if="!snapshot">
          <p class="empty">
            {{ t('head.released') }}
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
            <dt>{{ t('locales.current') }}</dt><dd>{{ snapshot.locale }}</dd>
            <dt>{{ t('locales.fallback') }}</dt><dd>{{ snapshot.fallbackLocale || '—' }}</dd>
            <dt>{{ t('locales.known') }}</dt><dd>{{ snapshot.knownLocales.join(', ') || '—' }}</dd>
            <dt>{{ t('locales.available') }}</dt><dd>{{ snapshot.availableLocales.join(', ') || '—' }}</dd>
          </dl>
        </template>

        <template v-else-if="tab === 'blocks'">
          <div class="actions">
            <span class="dim">{{ t('blocks.simulate') }}</span>
            <label>{{ t('blocks.delay') }} <input v-model.number="simulation.delay" class="num" type="number" min="0" step="100"></label>
            <label>{{ t('blocks.failPercent') }} <input v-model.number="simulation.failPercent" class="num" type="number" min="0" max="100" step="10"></label>
            <label>{{ t('blocks.first') }} <input v-model.number="simulation.failAttempts" class="num" type="number" min="0" max="9"></label>
            <button type="button" :class="{ on: simulating }" @click="toggleSimulation">
              {{ simulating ? t('blocks.stop') : t('blocks.start') }}
            </button>
          </div>
          <p v-if="simulating" class="cost">
            {{ t('blocks.simulating') }}
          </p>

          <p v-if="!snapshot.blocks.length" class="empty">
            {{ t('blocks.empty') }}
          </p>
          <table v-else>
            <thead>
              <tr>
                <th>{{ t('blocks.block') }}</th>
                <th>{{ t('blocks.locale') }}</th>
                <th>{{ t('blocks.status') }}</th>
                <th>{{ t('blocks.ms') }}</th>
                <th>{{ t('blocks.uses') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="block in snapshot.blocks" :key="`${block.locale}:${block.block}`">
                <td class="key">
                  {{ block.block }}
                  <span v-if="block.resolvedAs" class="chip">{{ t('blocks.via', { block: block.resolvedAs }) }}</span>
                  <div v-if="block.error" class="dim">
                    {{ block.error }}
                  </div>
                </td>
                <td>{{ block.locale }}</td>
                <td>
                  <span
                    class="chip"
                    :class="{ good: block.status === 'loaded', bad: block.status === 'failed', warn: block.status === 'unloaded' }"
                  >{{ t(`status.${block.status}`) }}</span>
                </td>
                <td class="dim">
{{ block.duration ?? '—' }}
</td>
                <td class="dim">
{{ snapshot.usage[block.block] ?? 0 }}
</td>
                <td>
                  <button type="button" :title="t('blocks.reload')" @click="run(() => devtools.actions.reloadBlock(block.block, block.locale))">
                    ↻
                  </button>
                  <button type="button" :title="t('blocks.unload')" @click="run(() => devtools.actions.unloadBlock(block.resolvedAs ?? block.block, block.locale))">
                    ⌫
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else-if="tab === 'dictionary'">
          <input v-model="filter" type="search" :placeholder="t('dictionary.filter')">
          <p v-if="dictionaryTotal > visibleDictionary.length" class="dim">
            {{ t('dictionary.showing', { shown: visibleDictionary.length, total: dictionaryTotal }) }}
          </p>
          <p v-if="!visibleDictionary.length" class="empty">
            {{ t('dictionary.empty') }}
          </p>
          <table v-else>
            <thead>
              <tr>
<th>{{ t('dictionary.key') }}</th><th v-for="locale in locales" :key="locale">
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
                    :placeholder="t('dictionary.addTo', { locale })"
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
              {{ t('missing.exportPatch') }}
            </button>
            <button v-if="onDisk" type="button" @click="persist(devtools.actions.missingKeysPatch(), false)">
              {{ t('missing.writeStub') }}
            </button>
            <span v-if="written" class="dim">{{ written }}</span>
          </div>
          <p v-if="!snapshot.missingKeys.length && !snapshot.fallbacks.length" class="empty">
            {{ t('missing.empty') }}
          </p>
          <table v-else>
            <thead>
              <tr>
                <th>{{ t('missing.key') }}</th>
                <th>{{ t('missing.locale') }}</th>
                <th>{{ t('missing.kind') }}</th>
                <th>{{ t('missing.count') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="miss in snapshot.missingKeys" :key="`m:${miss.locale}:${miss.key}`">
                <td class="key">
{{ miss.key }}
</td>
                <td>{{ miss.locale }}</td>
                <td><span class="chip bad">{{ t('missing.missing') }}</span></td>
                <td class="dim">
{{ miss.count }}
</td>
              </tr>
              <tr v-for="hit in snapshot.fallbacks" :key="`f:${hit.locale}:${hit.key}`">
                <td class="key">
{{ hit.key }}
</td>
                <td>{{ hit.locale }}</td>
                <td><span class="chip warn">{{ t('missing.from', { locale: hit.fallbackLocale }) }}</span></td>
                <td class="dim">
{{ hit.count }}
</td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else-if="tab === 'events'">
          <input v-model="filter" type="search" :placeholder="t('events.filter')">
          <p v-if="!visibleEvents.length" class="empty">
            {{ t('events.empty') }}
          </p>
          <div v-for="event in visibleEvents" v-else :key="event.id" class="event" :class="tone(event.type)">
            <span class="at">{{ time(event.at) }}</span>
            <span class="type">{{ event.type }}</span>
            <span class="payload">{{ short(event.payload) }}</span>
          </div>
        </template>

        <template v-else-if="tab === 'metrics'">
          <p class="cost">
            {{ t('metrics.cost') }}
          </p>

          <div class="actions">
            <span class="dim">{{ t('metrics.sample') }}</span>
            <button
              v-for="rate in SAMPLING"
              :key="rate"
              type="button"
              :class="{ on: metrics?.sampling === rate }"
              @click="sample(rate)"
            >
              1/{{ rate }}
            </button>
            <button type="button" @click="run(() => devtools.metrics.reset())">
              {{ t('metrics.reset') }}
            </button>
          </div>

          <dl v-if="metrics">
            <dt>{{ t('metrics.calls') }}</dt>
            <dd>{{ metrics.calls }}<span v-if="metrics.sampling > 1" class="dim"> ({{ t('metrics.counted', { counted: metrics.counted }) }})</span></dd>
            <dt>{{ t('metrics.distinctKeys') }}</dt>
            <dd>{{ metrics.distinctKeys }}</dd>
            <dt>{{ t('metrics.compiled') }}</dt>
            <dd>
              <template v-for="(count, locale) in metrics.compiled ?? {}" :key="locale">
                {{ locale }}: {{ count }}&nbsp;
              </template>
              <span v-if="!metrics.compiled">{{ t('common.unavailable') }}</span>
            </dd>
            <dt>{{ t('metrics.dictionary') }}</dt>
            <dd>
              <template v-for="(chars, locale) in metrics.dictionaryChars" :key="locale">
                {{ locale }}: {{ Math.round(chars / 1024) }}K&nbsp;
              </template>
            </dd>
          </dl>

          <p v-if="!metrics?.topKeys.length" class="empty">
            {{ t('metrics.empty') }}
          </p>
          <table v-else>
            <thead>
              <tr><th>{{ t('metrics.key') }}</th><th>{{ t('metrics.callsColumn') }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in metrics.topKeys" :key="row.key">
                <td class="key">
{{ row.key }}
</td>
                <td class="dim">
{{ row.calls }}
</td>
              </tr>
            </tbody>
          </table>

          <table v-if="metrics?.slowestBlocks.length">
            <thead>
              <tr>
                <th>{{ t('metrics.slowest') }}</th>
                <th>{{ t('blocks.locale') }}</th>
                <th>{{ t('blocks.ms') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in metrics.slowestBlocks" :key="`${row.locale}:${row.block}`">
                <td class="key">
{{ row.block }}
</td>
                <td>{{ row.locale }}</td>
                <td class="dim">
{{ row.duration }}
</td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-else>
          <div class="actions">
            <button type="button" @click="run(() => devtools.actions.clearCompiled())">
              {{ t('caches.clearCompiled') }}
            </button>
            <button type="button" @click="run(() => devtools.actions.clearFormatterCache())">
              {{ t('caches.clearFormatters') }}
            </button>
            <button type="button" @click="run(() => devtools.actions.clearPluralCache())">
              {{ t('caches.clearPlural') }}
            </button>
          </div>
          <dl>
            <dt>{{ t('caches.compiled') }}</dt>
            <dd>
              <template v-for="(count, locale) in snapshot.compiled ?? {}" :key="locale">
                {{ locale }}: {{ count }}&nbsp;
              </template>
              <span v-if="!snapshot.compiled">{{ t('common.unavailable') }}</span>
            </dd>
            <dt>{{ t('caches.registered') }}</dt>
            <dd>{{ snapshot.registeredBlocks?.join(', ') ?? t('common.unavailable') }}</dd>
            <dt>{{ t('caches.plugins') }}</dt>
            <dd>{{ snapshot.plugins?.join(', ') ?? t('common.unavailable') }}</dd>
            <dt>preloadFallback</dt>
            <dd>{{ snapshot.options?.preloadFallback ?? '—' }}</dd>
            <dt>unloadUnused</dt>
            <dd>{{ snapshot.options?.unloadUnusedBlocks ?? '—' }}</dd>
            <dt>retry</dt>
            <dd>{{ snapshot.options?.retry ? JSON.stringify(snapshot.options.retry) : t('common.off') }}</dd>
          </dl>
          <p class="empty">
            {{ t('caches.note') }}
          </p>
        </template>
      </div>

      <div class="grip" :title="t('grip.hint')" @pointerdown="startResize" />
    </div>
  </div>
</template>
