<script setup lang="ts">
/**
 * Оболочка секции витрины: карточка, надзаголовок, заголовок, описание.
 *
 * Тексты принимаются уже переведёнными, а не ключами. Ключ, собранный внутри
 * компонента из пропа, стал бы для `scripts/check-messages.mjs` динамическим,
 * и все `ui.sections.*` разом выпали бы из проверки «ключ есть в словаре».
 */
withDefaults(defineProps<{
  eyebrow: string
  title: string
  description: string
  /** `tinted` — светло-серая карточка под белые панели внутри, и наоборот. */
  tone?: 'plain' | 'tinted'
}>(), { tone: 'plain' })
</script>

<template>
  <section
    class="rounded-2xl border border-slate-200 p-5 md:p-6"
    :class="tone === 'tinted' ? 'bg-slate-50' : 'bg-white'"
  >
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="max-w-2xl flex flex-col gap-2">
        <p class="text-xs font-bold uppercase tracking-widest text-slate-500">
          {{ eyebrow }}
        </p>
        <h2 class="text-xl font-semibold text-slate-900">
          {{ title }}
        </h2>
        <p class="text-sm leading-6 text-slate-600">
          {{ description }}
        </p>
      </div>

      <slot name="aside" />
    </div>

    <slot />
  </section>
</template>
