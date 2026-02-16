<script setup lang="ts">
import type { UserPresence } from '@realtime-collab/shared';

defineProps<{
  users: UserPresence[];
  currentUserName: string;
  currentUserColor: string;
  isConnected: boolean;
}>();
</script>

<template>
  <div class="absolute top-4 right-4 flex items-center gap-2 z-10">
    <div
      :class="[
        'w-2 h-2 rounded-full',
        isConnected ? 'bg-green-400' : 'bg-red-400',
      ]"
    />

    <!-- Current user -->
    <div
      class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-gray-800"
      :style="{ backgroundColor: currentUserColor }"
      :title="currentUserName + ' (you)'"
    >
      {{ currentUserName.charAt(0).toUpperCase() }}
    </div>

    <!-- Remote users -->
    <div
      v-for="user in users"
      :key="user.userId"
      class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-gray-800 -ml-2"
      :style="{ backgroundColor: user.color }"
      :title="user.name"
    >
      {{ user.name.charAt(0).toUpperCase() }}
    </div>
  </div>
</template>
