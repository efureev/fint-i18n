<script setup lang="ts">
import { ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'
import PlaygroundSection from '../PlaygroundSection.vue'

const i18n = useFintI18n()
const { t, locale } = i18n

const isArticlesLoaded = ref(false)
const isTermsLoaded = ref(false)
const loadedPageBlocks = ref<string[]>([])

const refreshLoaded = () => {
  loadedPageBlocks.value = (i18n.getLoadedBlocks()[locale.value] ?? [])
    .filter(block => block === 'page' || block.startsWith('page.'))
    .sort()
}

// У `page.articles` есть собственный лоадер — грузится он сам и помечается
// загруженным под своим именем.
const loadArticles = async () => {
  await i18n.loadBlock('page.articles')
  isArticlesLoaded.value = true
  refreshLoaded()
}

// У `page.terms` собственного лоадера нет. Реестр поднимается вверх до `page`,
// грузит его — и помечает загруженным именно `page`, а не запрошенное имя.
const loadTerms = async () => {
  await i18n.loadBlock('page.terms')
  isTermsLoaded.value = true
  refreshLoaded()
}
</script>

<template>
  <PlaygroundSection
    :eyebrow="t('ui.sections.partial.eyebrow')"
    :title="t('ui.sections.partial.title')"
    :description="t('ui.sections.partial.description')"
  >
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
        data-test="load-terms"
        class="p-4 rounded-2xl border border-violet-100 bg-violet-50 hover:bg-violet-100/80 transition flex flex-col items-start text-left"
        type="button"
        @click="loadTerms"
      >
        <span class="i-lucide-corner-left-up text-violet-600 mb-3 text-lg" />
        <span class="text-sm font-bold text-violet-900">{{ t('ui.sections.partial.loadTerms') }}</span>
        <span class="text-xs text-violet-700/80 mt-1">{{ t('ui.sections.partial.loadTermsHint') }}</span>
        <span class="mt-4 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-violet-700">
          <span class="i-lucide-check-circle-2" />
          {{ isTermsLoaded ? t('ui.status.loaded') : t('ui.status.ready') }}
        </span>
      </button>
    </div>

    <div v-if="isArticlesLoaded || isTermsLoaded" class="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 flex flex-col gap-4">
      <div v-if="isArticlesLoaded">
        <h3 class="text-lg font-semibold text-slate-900">
          {{ t('page.articles.title') }}
        </h3>
        <p class="text-sm text-slate-600 mt-1">
          {{ t('page.articles.description') }}
        </p>
      </div>

      <div v-if="isTermsLoaded" class="border-t border-slate-200 pt-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-sm text-indigo-700 font-semibold">
            {{ t('page.terms.title') }}
          </p>
          <p class="text-sm text-slate-600 mt-1">
            {{ t('page.terms.content') }}
          </p>
        </div>
      </div>

      <div class="border-t border-slate-200 pt-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
          <span class="i-lucide-list-tree text-indigo-500" />
          {{ t('ui.sections.partial.loadedLabel') }}
        </p>
        <p class="font-mono text-xs text-slate-800" data-test="loaded-page-blocks">
          {{ loadedPageBlocks.join(', ') }}
        </p>
        <p class="mt-2 text-xs text-slate-500 leading-5">
          {{ t('ui.sections.partial.unloadHint') }}
        </p>
      </div>
    </div>
  </PlaygroundSection>
</template>
