<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';

const emit = defineEmits<{
  (e: 'authenticated'): void;
}>();

const authStore = useAuthStore();

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (token) {
    await authStore.handleCallback(token);
    // Clean URL
    window.history.replaceState({}, '', '/');
  }
  emit('authenticated');
});
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
      <p class="text-gray-400">{{ $t('auth.authenticating') }}</p>
    </div>
  </div>
</template>
