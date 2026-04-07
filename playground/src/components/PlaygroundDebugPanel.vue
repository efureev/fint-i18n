<script setup lang="ts">
import type { MessageSchema } from '@feugene/fint-i18n/core'

interface HookEventEntry {
  id: number
  name: string
  timestamp: string
  data: unknown
}

defineProps<{
  title: string
  loadedMessagesLabel: string
  runtimeHooksLabel: string
  emptyHooksLabel: string
  clearLabel: string
  blocksLabel: string
  keysLabel: string
  messages: Record<string, MessageSchema>
  hookEvents: HookEventEntry[]
}>()

const emit = defineEmits<{
  clear: []
}>()

const getObjectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return []
  }

  return Object.keys(value as Record<string, unknown>)
}

const stringifyPayload = (value: unknown): string => JSON.stringify(value, null, 2)
</script>

<template>
  <aside class="w-full md:w-96 md:self-start bg-gray-950 text-gray-300 border-l border-gray-800">
    <div class="p-6">
      <h2 class="text-white font-bold text-lg mb-6 flex items-center gap-2">
        <div class="i-lucide-bug text-red-400" />
        {{ title }}
      </h2>

      <section class="mb-8">
        <h3 class="text-xs font-bold uppercase text-gray-500 tracking-widest mb-4 flex items-center gap-2">
          <div class="i-lucide-database" />
          {{ loadedMessagesLabel }}
        </h3>

        <div
          v-for="(content, lang) in messages"
          :key="lang"
          class="mb-4 bg-gray-800/50 rounded p-3 border border-gray-700"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="font-mono text-indigo-400 font-bold uppercase">{{ lang }}</span>
            <span class="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">
              {{ getObjectKeys(content).length }} {{ blocksLabel }}
            </span>
          </div>

          <div class="flex flex-col gap-1">
            <div
              v-for="(keys, block) in content"
              :key="block"
              class="text-xs"
            >
              <div class="flex items-center gap-2">
                <span class="text-emerald-400 opacity-80">{{ block }}:</span>
                <span class="text-[9px] bg-emerald-900/30 text-emerald-500/70 px-1 rounded">
                  {{ getObjectKeys(keys).length }} {{ keysLabel }}
                </span>
              </div>
              <div class="text-gray-500 ml-2 font-mono text-[10px] break-all">
                [{{ getObjectKeys(keys).join(', ') }}]
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xs font-bold uppercase text-gray-500 tracking-widest flex items-center gap-2">
            <div class="i-lucide-activity" />
            {{ runtimeHooksLabel }}
          </h3>
          <button class="text-[10px] hover:text-white transition-colors" @click="emit('clear')">
            {{ clearLabel }}
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <div
            v-if="hookEvents.length === 0"
            class="text-center py-8 border border-dashed border-gray-700 rounded text-gray-600 text-sm italic"
          >
            {{ emptyHooksLabel }}
          </div>

          <div
            v-for="hook in hookEvents"
            :key="hook.id"
            class="text-[11px] border-l-2 border-indigo-500 bg-indigo-500/5 p-2 rounded-r"
          >
            <div class="flex justify-between items-start mb-1">
              <span class="font-bold text-indigo-300 font-mono">{{ hook.name }}</span>
              <span class="text-gray-600 text-[9px]">{{ hook.timestamp }}</span>
            </div>
            <div
              v-if="hook.data !== null && hook.data !== undefined"
              class="bg-black/30 p-1 rounded font-mono text-[9px] text-gray-400 overflow-x-auto"
            >
              <pre class="whitespace-pre-wrap">{{ stringifyPayload(hook.data) }}</pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  </aside>
</template>