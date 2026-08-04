<script setup lang="ts">
import { useFintI18n, useI18nScope } from '@feugene/fint-i18n/vue'
import PlaygroundDebugPanel from './components/PlaygroundDebugPanel.vue'
import BasicSection from './components/sections/BasicSection.vue'
import DirectiveSection from './components/sections/DirectiveSection.vue'
import DynamicLoadersSection from './components/sections/DynamicLoadersSection.vue'
import FallbackSection from './components/sections/FallbackSection.vue'
import FormatSection from './components/sections/FormatSection.vue'
import IntrospectionSection from './components/sections/IntrospectionSection.vue'
import LazyLoadSection from './components/sections/LazyLoadSection.vue'
import MemorySection from './components/sections/MemorySection.vue'
import PartialBlocksSection from './components/sections/PartialBlocksSection.vue'
import PlaygroundFooter from './components/sections/PlaygroundFooter.vue'
import PlaygroundHeader from './components/sections/PlaygroundHeader.vue'
import PluralSection from './components/sections/PluralSection.vue'
import ScopeSyncSection from './components/sections/ScopeSyncSection.vue'
import SubtreeSection from './components/sections/SubtreeSection.vue'
import WildcardSection from './components/sections/WildcardSection.vue'
import { usePlaygroundHooksFeed } from './composables/usePlaygroundHooksFeed'

const i18n = useFintI18n()
const { t, messages } = i18n

await useI18nScope(['common', 'ui'])

const { events: hookEvents, clear: clearHookEvents, probeTranslate } = usePlaygroundHooksFeed(i18n)
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-900 flex flex-col md:flex-row">
    <main class="flex-1 p-4 md:p-8">
      <div class="max-w-4xl mx-auto bg-white rounded-[28px] shadow-xl border border-slate-200 overflow-hidden">
        <PlaygroundHeader />

        <div class="px-6 py-6 md:px-8 md:py-8 flex flex-col gap-8">
          <BasicSection />
          <DirectiveSection />
          <LazyLoadSection />
          <PartialBlocksSection />
          <WildcardSection />
          <FallbackSection />
          <ScopeSyncSection />
          <MemorySection />
          <DynamicLoadersSection />
          <PluralSection />
          <FormatSection />
          <IntrospectionSection />
          <SubtreeSection />
        </div>

        <PlaygroundFooter />
      </div>
    </main>

    <PlaygroundDebugPanel
      :title="t('ui.debug.title')"
      :loaded-messages-label="t('ui.debug.loadedMessages')"
      :runtime-hooks-label="t('ui.debug.runtimeHooks')"
      :empty-hooks-label="t('ui.debug.empty')"
      :clear-label="t('ui.debug.clear')"
      :probe-label="t('ui.debug.probe')"
      :blocks-label="t('ui.debug.blocks')"
      :keys-label="t('ui.debug.keys')"
      :messages="messages"
      :hook-events="hookEvents"
      @clear="clearHookEvents"
      @probe-translate="probeTranslate"
    />
  </div>
</template>
