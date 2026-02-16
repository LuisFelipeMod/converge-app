import { ref, onUnmounted, shallowRef } from 'vue';
import * as Y from 'yjs';
import { io, Socket } from 'socket.io-client';
import { WsEvent } from '@realtime-collab/shared';
import type { Shape, UserPresence } from '@realtime-collab/shared';

export function useYjs(documentId: string, user: { userId: string; name: string; token: string }) {
  const doc = new Y.Doc();
  const shapes = doc.getMap<Shape>('shapes');
  const connected = ref(false);
  const shapesSnapshot = ref<Map<string, Shape>>(new Map());
  const peers = ref<Map<string, UserPresence>>(new Map());
  const socket = shallowRef<Socket | null>(null);

  function syncShapesSnapshot() {
    const map = new Map<string, Shape>();
    shapes.forEach((value, key) => {
      map.set(key, value);
    });
    shapesSnapshot.value = map;
  }

  function connect() {
    const s = io('/collaboration', {
      auth: { token: user.token },
      transports: ['websocket'],
    });
    socket.value = s;

    s.on('connect', () => {
      s.emit(WsEvent.JoinDocument, { documentId });
    });

    s.on(WsEvent.DocumentJoined, () => {
      connected.value = true;
    });

    // Server sends its state vector — client responds with diff
    s.on(WsEvent.SyncStep1, (data: { stateVector: number[] }) => {
      const remoteStateVector = new Uint8Array(data.stateVector);
      const diff = Y.encodeStateAsUpdate(doc, remoteStateVector);
      s.emit(WsEvent.SyncStep2, { update: Array.from(diff) });

      // Client also requests server state
      const localSV = Y.encodeStateVector(doc);
      s.emit(WsEvent.SyncStep1, { stateVector: Array.from(localSV) });
    });

    // Server responds with its diff
    s.on(WsEvent.SyncStep2, (data: { update: number[] }) => {
      const update = new Uint8Array(data.update);
      Y.applyUpdate(doc, update);
      syncShapesSnapshot();
    });

    // Incremental updates from peers
    s.on(WsEvent.Update, (data: { update: number[] }) => {
      const update = new Uint8Array(data.update);
      Y.applyUpdate(doc, update);
      syncShapesSnapshot();
    });

    // Awareness from peers
    s.on(WsEvent.AwarenessUpdate, (data: any) => {
      if (data.removed) {
        peers.value.delete(data.clientId);
        peers.value = new Map(peers.value);
      } else if (data.presence) {
        peers.value.set(data.clientId, data.presence);
        peers.value = new Map(peers.value);
      }
    });

    // Respond to awareness queries from new peers
    s.on(WsEvent.AwarenessQuery, () => {
      broadcastPresence(lastPresence);
    });

    // Local changes → broadcast to server
    doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin === 'remote') return;
      s.emit(WsEvent.Update, { update: Array.from(update) });
      syncShapesSnapshot();
    });
  }

  let lastPresence: Partial<UserPresence> = {};

  function broadcastPresence(presence: Partial<UserPresence>) {
    lastPresence = { ...lastPresence, ...presence };
    socket.value?.emit(WsEvent.AwarenessUpdate, {
      presence: {
        userId: user.userId,
        name: user.name,
        ...lastPresence,
        lastActive: Date.now(),
      },
    });
  }

  function addShape(shape: Shape) {
    shapes.set(shape.id, shape);
  }

  function updateShape(id: string, updates: Partial<Shape>) {
    const existing = shapes.get(id);
    if (existing) {
      shapes.set(id, { ...existing, ...updates } as Shape);
    }
  }

  function deleteShape(id: string) {
    shapes.delete(id);
  }

  function disconnect() {
    socket.value?.disconnect();
    doc.destroy();
  }

  onUnmounted(() => {
    disconnect();
  });

  connect();

  return {
    doc,
    shapes: shapesSnapshot,
    peers,
    connected,
    addShape,
    updateShape,
    deleteShape,
    broadcastPresence,
    disconnect,
  };
}
