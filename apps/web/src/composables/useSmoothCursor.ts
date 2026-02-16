import { ref, watch, onUnmounted } from 'vue';
import type { UserPresence } from '@realtime-collab/shared';

interface SpringState {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  opacity: number;
  targetOpacity: number;
}

export interface SmoothCursor {
  userId: string;
  name: string;
  color: string;
  avatar?: string;
  x: number;
  y: number;
  opacity: number;
}

const STIFFNESS = 120;
const DAMPING = 20;
const DT = 1 / 60;
const THRESHOLD = 0.5;
const OPACITY_SPEED = 8; // per second

export function useSmoothCursor(
  cursors: { value: UserPresence[] },
) {
  const springs = new Map<string, SpringState>();
  const smoothCursors = ref<SmoothCursor[]>([]);
  let rafId: number | null = null;
  let running = false;

  function ensureLoop() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(tick);
  }

  function tick() {
    let anyActive = false;

    for (const [userId, s] of springs) {
      // Spring physics
      const forceX = STIFFNESS * (s.targetX - s.currentX);
      const forceY = STIFFNESS * (s.targetY - s.currentY);
      s.velocityX += (forceX - DAMPING * s.velocityX) * DT;
      s.velocityY += (forceY - DAMPING * s.velocityY) * DT;
      s.currentX += s.velocityX * DT;
      s.currentY += s.velocityY * DT;

      // Opacity interpolation
      const opacityDiff = s.targetOpacity - s.opacity;
      s.opacity += opacityDiff * OPACITY_SPEED * DT;
      s.opacity = Math.max(0, Math.min(1, s.opacity));

      // Check if settled
      const distSq = (s.targetX - s.currentX) ** 2 + (s.targetY - s.currentY) ** 2;
      const velSq = s.velocityX ** 2 + s.velocityY ** 2;
      const opacitySettled = Math.abs(opacityDiff) < 0.01;

      if (distSq > THRESHOLD || velSq > THRESHOLD || !opacitySettled) {
        anyActive = true;
      }

      // Remove fully faded out cursors
      if (s.targetOpacity === 0 && s.opacity < 0.01) {
        springs.delete(userId);
      }
    }

    // Build output
    const result: SmoothCursor[] = [];
    for (const [userId, s] of springs) {
      if (s.opacity > 0.01) {
        // Find original user data for name/color
        const user = cursors.value.find((c) => c.userId === userId);
        result.push({
          userId,
          name: user?.name ?? '',
          color: user?.color ?? '#888',
          avatar: user?.avatar,
          x: s.currentX,
          y: s.currentY,
          opacity: s.opacity,
        });
      }
    }
    smoothCursors.value = result;

    if (anyActive) {
      rafId = requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }

  watch(
    () => cursors.value,
    (newCursors) => {
      const activeIds = new Set<string>();

      for (const user of newCursors) {
        if (!user.cursor) continue;
        activeIds.add(user.userId);

        const existing = springs.get(user.userId);
        if (existing) {
          existing.targetX = user.cursor.x;
          existing.targetY = user.cursor.y;
          existing.targetOpacity = 1;
        } else {
          // New cursor: start at target position (no jump)
          springs.set(user.userId, {
            currentX: user.cursor.x,
            currentY: user.cursor.y,
            targetX: user.cursor.x,
            targetY: user.cursor.y,
            velocityX: 0,
            velocityY: 0,
            opacity: 0,
            targetOpacity: 1,
          });
        }
      }

      // Fade out cursors that left
      for (const [userId, s] of springs) {
        if (!activeIds.has(userId)) {
          s.targetOpacity = 0;
        }
      }

      ensureLoop();
    },
    { deep: true },
  );

  onUnmounted(() => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    running = false;
  });

  return { smoothCursors };
}
