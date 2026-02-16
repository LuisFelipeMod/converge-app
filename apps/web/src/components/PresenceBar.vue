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
  <div class="absolute top-16 right-4 flex items-center gap-2 z-10 glass rounded-xl px-3 py-2 animate-slide-down">
    <div
      :class="[
        'w-2 h-2 rounded-full transition-colors duration-300',
        isConnected ? 'bg-green-400 animate-pulse-subtle' : 'bg-red-400',
      ]"
    />

    <!-- Current user -->
    <img
      v-if="currentUserAvatar"
      :src="currentUserAvatar"
      class="w-8 h-8 rounded-full ring-2 ring-white/10 object-cover"
      :title="currentUserName + ' ' + t('presence.you')"
    />
    <div
      v-else
      class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white/10"
      :style="{ backgroundColor: currentUserColor }"
      :title="currentUserName + ' ' + t('presence.you')"
    >
      {{ currentUserName.charAt(0).toUpperCase() }}
    </div>

    <!-- Remote users -->
    <template v-for="(user, index) in users" :key="user.userId">
      <img
        v-if="user.avatar"
        :src="user.avatar"
        class="w-8 h-8 rounded-full ring-2 ring-white/10 -ml-2 object-cover animate-fade-in-up"
        :style="{ animationDelay: `${index * 50}ms` }"
        :title="user.name"
      />
      <div
        v-else
        class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white/10 -ml-2 animate-fade-in-up"
        :style="{ backgroundColor: user.color, animationDelay: `${index * 50}ms` }"
        :title="user.name"
      >
        {{ user.name.charAt(0).toUpperCase() }}
      </div>
    </template>
  </div>
</template>
