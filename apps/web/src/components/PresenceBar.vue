<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { UserPresence } from '@realtime-collab/shared';

const { t } = useI18n();

defineProps<{
  users: UserPresence[];
  currentUserName: string;
  currentUserColor: string;
  currentUserAvatar?: string;
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
    <img
      v-if="currentUserAvatar"
      :src="currentUserAvatar"
      class="w-8 h-8 rounded-full ring-2 ring-gray-800 object-cover"
      :title="currentUserName + ' ' + t('presence.you')"
    />
    <div
      v-else
      class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-gray-800"
      :style="{ backgroundColor: currentUserColor }"
      :title="currentUserName + ' ' + t('presence.you')"
    >
      {{ currentUserName.charAt(0).toUpperCase() }}
    </div>

    <!-- Remote users -->
    <template v-for="user in users" :key="user.userId">
      <img
        v-if="user.avatar"
        :src="user.avatar"
        class="w-8 h-8 rounded-full ring-2 ring-gray-800 -ml-2 object-cover"
        :title="user.name"
      />
      <div
        v-else
        class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-gray-800 -ml-2"
        :style="{ backgroundColor: user.color }"
        :title="user.name"
      >
        {{ user.name.charAt(0).toUpperCase() }}
      </div>
    </template>
  </div>
</template>
