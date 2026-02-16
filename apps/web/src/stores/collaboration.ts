import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { PRESENCE_COLORS } from '@realtime-collab/shared';
import type { Tool } from '@/types';
import { useAuthStore } from './auth';

export const useCollaborationStore = defineStore('collaboration', () => {
  const authStore = useAuthStore();

  const documentId = ref<string | null>(null);
  const activeTool = ref<Tool>('select');
  const isConnected = ref(false);

  const userId = computed(() => authStore.user?.userId || '');
  const userName = computed(() => authStore.user?.name || 'Anonymous');
  const userAvatar = computed(() => authStore.user?.avatar || null);
  const userColor = computed(() => pickColor(userId.value));
  const token = computed(() => authStore.token);

  function setDocument(id: string) {
    documentId.value = id;
  }

  function setTool(tool: Tool) {
    activeTool.value = tool;
  }

  function setConnected(val: boolean) {
    isConnected.value = val;
  }

  return {
    documentId,
    userId,
    userName,
    userAvatar,
    userColor,
    activeTool,
    isConnected,
    token,
    setDocument,
    setTool,
    setConnected,
  };
});

function pickColor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}
