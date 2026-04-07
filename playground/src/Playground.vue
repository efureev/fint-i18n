<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useFintI18n, useI18nScope } from '@feugene/fint-i18n/vue'
import PlaygroundDebugPanel from './components/PlaygroundDebugPanel.vue'
import { usePlaygroundHooksFeed } from './composables/usePlaygroundHooksFeed'

const i18n = useFintI18n()
const { t, locale, messages } = i18n

await useI18nScope(['common', 'ui'])

const name = ref('Senior Developer')
const showAuth = ref(false)
const isArticlesLoaded = ref(false)
const isPageLoaded = ref(false)

const AuthPanel = defineAsyncComponent({
  loader: () => import('./components/AuthPanel.vue'),
  onError(error) {
    throw error
  },
})

const { events: hookEvents, clear: clearHookEvents } = usePlaygroundHooksFeed(i18n)

const localeBadge = computed(() => locale.value.toUpperCase())
const loadedBlocksCount = computed(() => Object.keys(messages[locale.value] ?? {}).length)

const toggleLocale = async () => {
  await i18n.setLocale(i18n.locale.value === 'en' ? 'ru' : 'en')
}

const showAuthPanel = () => {
  showAuth.value = true
}

const loadArticles = async () => {
  await i18n.loadBlock('page.articles')
  isArticlesLoaded.value = true
}

const loadFullPage = async () => {
  await i18n.loadBlock('page')
  isPageLoaded.value = true
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-900 flex flex-col md:flex-row">
    <main class="flex-1 p-4 md:p-8">
      <div class="max-w-4xl mx-auto bg-white rounded-[28px] shadow-xl border border-slate-200 overflow-hidden">
        <header class="bg-slate-950 text-white px-6 py-6 md:px-8">
          <div class="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div class="max-w-2xl">
              <p class="text-xs uppercase tracking-[0.32em] text-slate-400 mb-3">
                {{ t('ui.header.eyebrow') }}
              </p>
              <h1 class="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <span class="i-lucide-languages text-indigo-300" />
                {{ t('ui.header.title') }}
              </h1>
              <p class="text-sm md:text-base text-slate-300 mt-3 leading-6">
                {{ t('ui.header.description') }}
              </p>
            </div>

            <div class="flex flex-col gap-3 md:items-end">
              <div class="inline-flex items-center gap-2 rounded-full bg-white/8 border border-white/10 px-3 py-1.5 text-xs text-slate-300">
                <span class="i-lucide-badge-info text-indigo-300" />
                {{ t('ui.header.localeBadge') }}
                <span class="rounded-full bg-indigo-500/20 px-2 py-0.5 text-indigo-200 font-semibold">{{ localeBadge }}</span>
              </div>

              <button
                data-test="toggle-locale"
                class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition font-medium border border-indigo-300/20 shadow-lg shadow-indigo-950/25"
                type="button"
                @click="toggleLocale"
              >
                <span class="i-lucide-repeat" />
                {{ t('common.changeLang') }}
              </button>

              <p class="text-xs text-slate-400 max-w-xs md:text-right">
                {{ t('ui.header.toggleHint') }}
              </p>
            </div>
          </div>
        </header>

        <div class="px-6 py-6 md:px-8 md:py-8 flex flex-col gap-8">
          <section class="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div class="max-w-2xl flex flex-col gap-2">
                <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                  {{ t('ui.sections.basic.eyebrow') }}
                </p>
                <h2 class="text-xl font-semibold text-slate-900">
                  {{ t('ui.sections.basic.title') }}
                </h2>
                <p class="text-sm leading-6 text-slate-600">
                  {{ t('ui.sections.basic.description') }}
                </p>
              </div>

              <div class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <span class="i-lucide-box" />
                {{ t('common.blocks', { blocks: loadedBlocksCount }) }}
              </div>
            </div>

            <div class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
              <div>
                <h3 class="text-2xl font-semibold text-slate-900">
                  {{ t('common.welcome', { name }) }}
                </h3>
                <p class="mt-2 text-sm text-slate-600 flex items-center gap-2">
                  <span class="i-lucide-info text-blue-500 w-4 h-4" />
                  {{ t('common.currentLang', { lang: locale }) }}
                </p>
              </div>

              <label class="flex flex-col gap-2 text-sm font-medium text-slate-700">
                {{ t('ui.sections.basic.inputLabel') }}
                <input
                  v-model="name"
                  type="text"
                  class="px-3.5 py-2.5 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
                  :placeholder="t('common.namePlaceholder')"
                >
              </label>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <div class="max-w-2xl flex flex-col gap-2">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                {{ t('ui.sections.directive.eyebrow') }}
              </p>
              <h2 class="text-xl font-semibold text-slate-900">
                {{ t('ui.sections.directive.title') }}
              </h2>
              <p class="text-sm leading-6 text-slate-600">
                {{ t('ui.sections.directive.description') }}
              </p>
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-2">
              <div class="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <span class="text-xs text-blue-700 font-bold block mb-2 uppercase tracking-wide">{{ t('ui.sections.directive.normalLabel') }}</span>
                <span v-t="'common.changeLang'" class="text-blue-900 font-medium" />
              </div>

              <div class="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <span class="text-xs text-amber-700 font-bold block mb-2 uppercase tracking-wide">{{ t('ui.sections.directive.onceLabel') }}</span>
                <span v-t.once="'common.changeLang'" class="text-amber-900 font-medium" />
                <p class="text-[11px] text-amber-700/80 mt-2 leading-5">
                  {{ t('ui.sections.directive.onceHint') }}
                </p>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <div class="max-w-2xl flex flex-col gap-2">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                {{ t('ui.sections.lazy.eyebrow') }}
              </p>
              <h2 class="text-xl font-semibold text-slate-900">
                {{ t('ui.sections.lazy.title') }}
              </h2>
              <p class="text-sm leading-6 text-slate-600">
                {{ t('ui.sections.lazy.description') }}
              </p>
            </div>

            <div class="mt-6 flex flex-col gap-4">
              <button
                v-if="!showAuth"
                data-test="load-auth"
                class="w-full py-3.5 border-2 border-dashed border-slate-300 rounded-2xl text-slate-600 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/60 transition-all flex items-center justify-center gap-2 font-medium"
                type="button"
                @click="showAuthPanel"
              >
                <span class="i-lucide-plus-circle" />
                {{ t('ui.sections.lazy.button') }}
              </button>

              <Suspense v-else>
                <template #default>
                  <AuthPanel />
                </template>

                <template #fallback>
                  <div class="p-8 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 bg-slate-50">
                    <div class="i-lucide-loader-2 animate-spin mx-auto w-8 h-8 mb-3" />
                    {{ t('ui.sections.lazy.loading') }}
                  </div>
                </template>
              </Suspense>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <div class="max-w-2xl flex flex-col gap-2">
              <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                {{ t('ui.sections.partial.eyebrow') }}
              </p>
              <h2 class="text-xl font-semibold text-slate-900">
                {{ t('ui.sections.partial.title') }}
              </h2>
              <p class="text-sm leading-6 text-slate-600">
                {{ t('ui.sections.partial.description') }}
              </p>
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-2">
              <button
                data-test="load-articles"
                class="p-4 rounded-2xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100/80 transition flex flex-col items-start text-left"
                type="button"
                @click="loadArticles"
              >
                <span class="i-lucide-file-text text-emerald-600 mb-3 text-lg" />
                <span class="text-sm font-bold text-emerald-900">{{ t('ui.sections.partial.loadArticles') }}</span>
                <span class="text-xs text-emerald-700/80 mt-1">{{ t('ui.sections.partial.loadArticlesHint') }}</span>
                <span class="mt-4 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  <span class="i-lucide-check-circle-2" />
                  {{ isArticlesLoaded ? t('ui.status.loaded') : t('ui.status.ready') }}
                </span>
              </button>

              <button
                data-test="load-page"
                class="p-4 rounded-2xl border border-violet-100 bg-violet-50 hover:bg-violet-100/80 transition flex flex-col items-start text-left"
                type="button"
                @click="loadFullPage"
              >
                <span class="i-lucide-layers text-violet-600 mb-3 text-lg" />
                <span class="text-sm font-bold text-violet-900">{{ t('ui.sections.partial.loadPage') }}</span>
                <span class="text-xs text-violet-700/80 mt-1">{{ t('ui.sections.partial.loadPageHint') }}</span>
                <span class="mt-4 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-violet-700">
                  <span class="i-lucide-check-circle-2" />
                  {{ isPageLoaded ? t('ui.status.loaded') : t('ui.status.ready') }}
                </span>
              </button>
            </div>

            <div v-if="isArticlesLoaded || isPageLoaded" class="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 flex flex-col gap-4">
              <div v-if="isArticlesLoaded">
                <h3 class="text-lg font-semibold text-slate-900">{{ t('page.articles.title') }}</h3>
                <p class="text-sm text-slate-600 mt-1">{{ t('page.articles.description') }}</p>
              </div>

              <div v-if="isPageLoaded" class="border-t border-slate-200 pt-4">
                <h4 class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500 mb-3">
                  {{ t('ui.sections.partial.fullPageLabel') }}
                </h4>
                <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p class="text-sm text-indigo-700 font-semibold">{{ t('page.terms.title') }}</p>
                  <p class="text-sm text-slate-600 mt-1">{{ t('page.terms.content') }}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer class="bg-slate-50 border-t border-slate-200 px-6 py-4 md:px-8 flex flex-col gap-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <div class="flex flex-wrap gap-4">
            <span class="flex items-center gap-1.5">
              <span class="i-lucide-zap text-yellow-500" />
              {{ t('ui.footer.lazy') }}
            </span>
            <span class="flex items-center gap-1.5">
              <span class="i-lucide-box text-blue-500" />
              {{ t('ui.footer.vue') }}
            </span>
            <span class="flex items-center gap-1.5">
              <span class="i-lucide-layers-3 text-violet-500" />
              {{ t('ui.footer.scope') }}
            </span>
          </div>

          <span>v0.1.0</span>
        </footer>
      </div>
    </main>

    <PlaygroundDebugPanel
      :title="t('ui.debug.title')"
      :loaded-messages-label="t('ui.debug.loadedMessages')"
      :runtime-hooks-label="t('ui.debug.runtimeHooks')"
      :empty-hooks-label="t('ui.debug.empty')"
      :clear-label="t('ui.debug.clear')"
      :blocks-label="t('ui.debug.blocks')"
      :keys-label="t('ui.debug.keys')"
      :messages="messages"
      :hook-events="hookEvents"
      @clear="clearHookEvents"
    />
  </div>
</template>
