import { computed } from 'vue';
import type { UserPresence } from '@realtime-collab/shared';
import { THROTTLE_MS } from '@realtime-collab/shared';

export function useAwareness(
  peers: { value: Map<string, UserPresence> },
  broadcastPresence: (presence: Partial<UserPresence>) => void,
  userColor: string,
) {
  let lastBroadcast = 0;

  function updateCursor(x: number, y: number) {
    const now = Date.now();
    if (now - lastBroadcast < THROTTLE_MS) return;
    lastBroadcast = now;

    broadcastPresence({
      cursor: { x, y },
      color: userColor,
    });
  }

  function clearCursor() {
    broadcastPresence({ cursor: null });
  }

  const onlineUsers = computed(() => {
    return Array.from(peers.value.values()).filter(
      (p) => Date.now() - p.lastActive < 30_000,
    );
  });

  const cursors = computed(() => {
    return Array.from(peers.value.values()).filter((p) => p.cursor !== null);
  });

  return {
    updateCursor,
    clearCursor,
    onlineUsers,
    cursors,
  };
}
