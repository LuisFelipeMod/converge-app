import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { PRESENCE_COLORS } from '@realtime-collab/shared';
import type { Tool } from '@/types';

export const useCollaborationStore = defineStore('collaboration', () => {
  const documentId = ref<string | null>(null);
  const userId = ref(generateUserId());
  const userName = ref(`User-${userId.value.slice(0, 4)}`);
  const userColor = ref(pickColor(userId.value));
  const activeTool = ref<Tool>('select');
  const isConnected = ref(false);

  const token = computed(() => {
    return generateSimpleToken(userId.value, userName.value);
  });

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
    userColor,
    activeTool,
    isConnected,
    token,
    setDocument,
    setTool,
    setConnected,
  };
});

function generateUserId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pickColor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

function generateSimpleToken(userId: string, name: string): string {
  // In production, this would come from a real auth flow.
  // For MVP/demo, we create a simple payload (server will validate with shared secret)
  const payload = btoa(JSON.stringify({ userId, name }));
  return `${payload}.dev`;
}
