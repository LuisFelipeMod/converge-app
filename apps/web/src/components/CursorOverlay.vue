<script setup lang="ts">
import type { UserPresence } from '@realtime-collab/shared';

defineProps<{
  cursors: UserPresence[];
}>();
</script>

<template>
  <g class="cursor-overlay">
    <g
      v-for="user in cursors"
      :key="user.userId"
      :transform="`translate(${user.cursor!.x}, ${user.cursor!.y})`"
    >
      <!-- Cursor arrow -->
      <path
        d="M0,0 L0,14 L4,10 L8,16 L10,15 L6,9 L12,9 Z"
        :fill="user.color"
        stroke="white"
        stroke-width="0.5"
      />
      <!-- Name label -->
      <rect
        x="12"
        y="10"
        :width="user.name.length * 7 + 8"
        height="18"
        rx="3"
        :fill="user.color"
      />
      <text
        x="16"
        y="23"
        fill="white"
        font-size="11"
        font-family="sans-serif"
      >
        {{ user.name }}
      </text>
    </g>
  </g>
</template>
