export type EdgeX = 'left' | 'right'
export type EdgeY = 'top' | 'bottom'

export interface Anchor {
  edgeX: EdgeX
  edgeY: EdgeY
  /** Отступ до соответствующего края, px. */
  dx: number
  dy: number
}

export interface Size {
  w: number
  h: number
}

export interface Layout {
  anchor?: Anchor
  size?: Size
}

export interface Viewport {
  width: number
  height: number
}

const KEY = 'fint-i18n-devtools:layout'
/** Ближе этого к краю — панель на него прилипает. */
export const SNAP_THRESHOLD = 24
/** Отступ прилипшей панели: вплотную к краю она выглядит обрезанной. */
export const SNAP_MARGIN = 16
/** Сколько держать видимым, когда размер элемента неизвестен. */
const KEEP_X = 64
const KEEP_Y = 32

/**
 * Наименьший размер панели. Эти же числа подставляются в `min-*` в `styles.ts`:
 * жест упирается в них, а CSS их же и держит. Разъехавшись, они дадут панель,
 * которая рисуется крупнее запрошенного и на часть жеста не отзывается.
 */
export const MIN_W = 320
export const MIN_H = 200

const EDGES_X: EdgeX[] = ['left', 'right']
const EDGES_Y: EdgeY[] = ['top', 'bottom']

/**
 * Хранилище положения. `false` — не хранить вовсе.
 *
 * По умолчанию `localStorage`, но добытый осторожно: на opaque origin обращение
 * к нему бросает, а в части окружений (включая прогон тестов) его попросту нет.
 */
export function resolveStorage(storage?: Storage | false): Storage | null {
  if (storage === false) return null
  if (storage) return storage

  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  }
  catch {
    return null
  }
}

const isFinitePositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * Читает сохранённое положение. Битая или неполноценная запись не применяется и
 * удаляется: иначе панель спотыкалась бы о неё при каждом открытии.
 */
export function readLayout(storage: Storage | null): Layout | null {
  if (!storage) return null

  const raw = storage.getItem(KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Layout
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object')

    const layout: Layout = {}

    if (parsed.anchor !== undefined) {
      const { edgeX, edgeY, dx, dy } = parsed.anchor
      if (!EDGES_X.includes(edgeX) || !EDGES_Y.includes(edgeY)) throw new Error('bad edge')
      if (!isFinitePositive(dx) || !isFinitePositive(dy)) throw new Error('bad offset')

      layout.anchor = { edgeX, edgeY, dx, dy }
    }

    if (parsed.size !== undefined) {
      const { w, h } = parsed.size
      if (!isFinitePositive(w) || !isFinitePositive(h)) throw new Error('bad size')

      layout.size = { w, h }
    }

    return layout
  }
  catch {
    storage.removeItem(KEY)
    return null
  }
}

/**
 * Дописывает поля к сохранённому положению. Именно дописывает: перетаскивание
 * знает только про привязку, растягивание — только про размер, и запись целиком
 * стирала бы чужую половину.
 */
export function writeLayout(storage: Storage | null, patch: Layout): void {
  if (!storage) return

  try {
    storage.setItem(KEY, JSON.stringify({ ...readLayout(storage), ...patch }))
  }
  catch {
    // Квота или приватный режим — положение панели не то, ради чего стоит падать.
  }
}

export function clearLayout(storage: Storage | null): void {
  storage?.removeItem(KEY)
}

/**
 * Не даёт панели уехать за окно. Клампится **целиком**, а не «оставим уголок»:
 * панель, наполовину вывалившаяся за край, бесполезна ровно так же, как
 * улетевшая целиком.
 */
export function clampPosition(x: number, y: number, size: Size, viewport: Viewport): { x: number, y: number } {
  // Размер бывает неизвестен (элемент не измерен), и тогда «панель целиком»
  // выродилось бы в «можно к самому краю» — то есть за экран. Держим видимым
  // хотя бы уголок.
  const w = size.w || KEEP_X
  const h = size.h || KEEP_Y

  return {
    x: Math.max(0, Math.min(x, Math.max(0, viewport.width - w))),
    y: Math.max(0, Math.min(y, Math.max(0, viewport.height - h))),
  }
}

/** До какого края ближе по каждой оси — к нему панель и привязывается. */
export function nearestEdges(x: number, y: number, size: Size, viewport: Viewport): { edgeX: EdgeX, edgeY: EdgeY, dx: number, dy: number } {
  const right = viewport.width - (x + size.w)
  const bottom = viewport.height - (y + size.h)

  return {
    edgeX: x <= right ? 'left' : 'right',
    edgeY: y <= bottom ? 'top' : 'bottom',
    dx: Math.max(0, Math.min(x, right)),
    dy: Math.max(0, Math.min(y, bottom)),
  }
}

/** Достаточно ли близко к краю, чтобы прилипнуть. */
export function willSnap(x: number, y: number, size: Size, viewport: Viewport): boolean {
  const { dx, dy } = nearestEdges(x, y, size, viewport)

  return dx <= SNAP_THRESHOLD || dy <= SNAP_THRESHOLD
}

/**
 * Координаты → привязка. Отступ в пределах порога схлопывается к `SNAP_MARGIN` —
 * это и есть прилипание, и оно же делает положение переносимым между экранами.
 */
export function anchorFrom(x: number, y: number, size: Size, viewport: Viewport): Anchor {
  const { edgeX, edgeY, dx, dy } = nearestEdges(x, y, size, viewport)

  return {
    edgeX,
    edgeY,
    dx: dx <= SNAP_THRESHOLD ? SNAP_MARGIN : dx,
    dy: dy <= SNAP_THRESHOLD ? SNAP_MARGIN : dy,
  }
}

/**
 * Привязка → координаты. Отсюда берётся «край окна сдвинулся — панель поехала за
 * ним»: у привязанной к правому краю отступ до него постоянен, а `left`
 * пересчитывается от новой ширины окна.
 */
export function toPosition(anchor: Anchor, size: Size, viewport: Viewport): { x: number, y: number } {
  const x = anchor.edgeX === 'left' ? anchor.dx : viewport.width - size.w - anchor.dx
  const y = anchor.edgeY === 'top' ? anchor.dy : viewport.height - size.h - anchor.dy

  return clampPosition(x, y, size, viewport)
}

/** Размер не должен превышать окно: запись могла приехать с монитора побольше. */
export function clampSize(size: Size, viewport: Viewport): Size {
  // Верхняя граница не опускается ниже минимума: в окне уже минимума панель
  // всё равно рисуется по `min-*`, и запрашивать меньше — значит разойтись с ним.
  return {
    w: Math.min(Math.max(size.w, MIN_W), Math.max(MIN_W, viewport.width - SNAP_MARGIN)),
    h: Math.min(Math.max(size.h, MIN_H), Math.max(MIN_H, viewport.height - SNAP_MARGIN)),
  }
}

/**
 * Годится ли окно для пересчёта. Свёрнутое окно отдаёт нули, и считать по ним
 * значит записать в панель размеры и координаты, которых не бывает.
 */
export function isUsableViewport(viewport: Viewport): boolean {
  return viewport.width > 0 && viewport.height > 0
}
