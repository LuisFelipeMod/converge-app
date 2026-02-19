<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Shape } from '@realtime-collab/shared';

const { t } = useI18n();

const props = defineProps<{
  shape: Shape;
}>();

const emit = defineEmits<{
  (e: 'update', updates: Partial<Shape>): void;
}>();

const fontFamilies = [
  { id: 'sans', value: 'sans-serif', label: 'Sans' },
  { id: 'serif', value: 'Georgia, serif', label: 'Serif' },
  { id: 'mono', value: 'monospace', label: 'Mono' },
];

const fontSizes = [
  { id: 's', value: 14, label: 'S' },
  { id: 'm', value: 18, label: 'M' },
  { id: 'l', value: 24, label: 'L' },
  { id: 'xl', value: 32, label: 'XL' },
];

const textColors = [
  { id: 'white', value: '#ffffff' },
  { id: 'red', value: '#EF4444' },
  { id: 'orange', value: '#F97316' },
  { id: 'yellow', value: '#EAB308' },
  { id: 'green', value: '#22C55E' },
  { id: 'cyan', value: '#06B6D4' },
  { id: 'blue', value: '#3B82F6' },
  { id: 'purple', value: '#8B5CF6' },
];

const currentFontFamily = computed(() => props.shape.fontFamily || 'sans-serif');
const currentFontSize = computed(() => props.shape.fontSize || 16);
const currentTextColor = computed(() => props.shape.textColor || '#ffffff');

function isActiveFontFamily(value: string): boolean {
  return currentFontFamily.value === value;
}

function isActiveFontSize(value: number): boolean {
  // Match closest preset
  const diffs = fontSizes.map(s => Math.abs(s.value - currentFontSize.value));
  const minIdx = diffs.indexOf(Math.min(...diffs));
  return fontSizes[minIdx].value === value;
}

function isActiveColor(value: string): boolean {
  return currentTextColor.value.toLowerCase() === value.toLowerCase();
}
</script>

<template>
  <div
    class="absolute left-4 top-1/2 -translate-y-1/2 z-10 animate-fade-in"
    @mousedown.stop
  >
    <div class="glass rounded-xl p-3 shadow-2xl flex flex-col gap-3 w-[140px]">
      <!-- Font Family -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{{ t('text.fontFamily') }}</div>
        <div class="flex gap-1">
          <button
            v-for="ff in fontFamilies"
            :key="ff.id"
            :class="[
              'flex-1 px-1.5 py-1 rounded text-[11px] transition-colors',
              isActiveFontFamily(ff.value)
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-white/5',
            ]"
            :style="{ fontFamily: ff.value }"
            :title="ff.label"
            @click="emit('update', { fontFamily: ff.value } as any)"
          >
            {{ ff.label }}
          </button>
        </div>
      </div>

      <!-- Font Size -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{{ t('text.fontSize') }}</div>
        <div class="flex gap-1">
          <button
            v-for="fs in fontSizes"
            :key="fs.id"
            :class="[
              'flex-1 px-1.5 py-1 rounded text-[11px] transition-colors',
              isActiveFontSize(fs.value)
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-white/5',
            ]"
            :title="`${fs.value}px`"
            @click="emit('update', { fontSize: fs.value } as any)"
          >
            {{ fs.label }}
          </button>
        </div>
      </div>

      <!-- Text Color -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{{ t('text.color') }}</div>
        <div class="flex flex-wrap gap-1.5 justify-center">
          <button
            v-for="tc in textColors"
            :key="tc.id"
            class="w-5 h-5 rounded-full transition-all"
            :class="isActiveColor(tc.value) ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-800 scale-110' : 'hover:scale-110'"
            :style="{ backgroundColor: tc.value }"
            :title="tc.id"
            @click="emit('update', { textColor: tc.value } as any)"
          />
        </div>
      </div>

      <!-- Bold / Italic -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{{ t('text.style') }}</div>
        <div class="flex gap-1">
          <button
            :class="[
              'flex-1 px-2 py-1 rounded text-xs font-bold transition-colors',
              shape.bold
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-white/5',
            ]"
            :title="t('shape.bold')"
            @click="emit('update', { bold: !shape.bold } as any)"
          >
            B
          </button>
          <button
            :class="[
              'flex-1 px-2 py-1 rounded text-xs transition-colors',
              shape.italic
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-white/5',
            ]"
            :title="t('shape.italic')"
            style="font-style: italic;"
            @click="emit('update', { italic: !shape.italic } as any)"
          >
            I
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
