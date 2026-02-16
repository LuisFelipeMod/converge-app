import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  PERSIST_DEBOUNCE_MS,
  ROOM_CLEANUP_TIMEOUT_MS,
} from '@realtime-collab/shared';

interface Room {
  doc: Y.Doc;
  connections: Set<string>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  pendingUpdates: Uint8Array[];
}

@Injectable()
export class CollaborationService implements OnModuleDestroy {
  private readonly logger = new Logger(CollaborationService.name);
  private rooms = new Map<string, Room>();

  constructor(private prisma: PrismaService) {}

  async onModuleDestroy() {
    for (const [docId, room] of this.rooms) {
      if (room.persistTimer) clearTimeout(room.persistTimer);
      if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
      await this.persistUpdates(docId, room);
      room.doc.destroy();
    }
    this.rooms.clear();
  }

  async getOrCreateRoom(documentId: string): Promise<Room> {
    let room = this.rooms.get(documentId);
    if (room) {
      if (room.cleanupTimer) {
        clearTimeout(room.cleanupTimer);
        room.cleanupTimer = null;
      }
      return room;
    }

    const doc = new Y.Doc();
    room = {
      doc,
      connections: new Set(),
      persistTimer: null,
      cleanupTimer: null,
      pendingUpdates: [],
    };

    await this.loadDocumentState(documentId, doc);

    this.rooms.set(documentId, room);
    this.logger.log(`Room created for document ${documentId}`);

    return room;
  }

  addConnection(documentId: string, clientId: string) {
    const room = this.rooms.get(documentId);
    if (room) {
      room.connections.add(clientId);
      this.logger.debug(
        `Client ${clientId} joined room ${documentId} (${room.connections.size} connected)`,
      );
    }
  }

  removeConnection(documentId: string, clientId: string) {
    const room = this.rooms.get(documentId);
    if (!room) return;

    room.connections.delete(clientId);
    this.logger.debug(
      `Client ${clientId} left room ${documentId} (${room.connections.size} connected)`,
    );

    if (room.connections.size === 0) {
      room.cleanupTimer = setTimeout(() => {
        this.cleanupRoom(documentId);
      }, ROOM_CLEANUP_TIMEOUT_MS);
    }
  }

  getDoc(documentId: string): Y.Doc | null {
    return this.rooms.get(documentId)?.doc ?? null;
  }

  getStateVector(documentId: string): Uint8Array | null {
    const doc = this.getDoc(documentId);
    if (!doc) return null;
    return Y.encodeStateVector(doc);
  }

  getStateDiff(documentId: string, remoteStateVector: Uint8Array): Uint8Array | null {
    const doc = this.getDoc(documentId);
    if (!doc) return null;
    return Y.encodeStateAsUpdate(doc, remoteStateVector);
  }

  applyUpdate(documentId: string, update: Uint8Array) {
    const room = this.rooms.get(documentId);
    if (!room) return;

    Y.applyUpdate(room.doc, update);
    room.pendingUpdates.push(update);
    this.schedulePersist(documentId, room);
  }

  private schedulePersist(documentId: string, room: Room) {
    if (room.persistTimer) return;

    room.persistTimer = setTimeout(async () => {
      room.persistTimer = null;
      await this.persistUpdates(documentId, room);
    }, PERSIST_DEBOUNCE_MS);
  }

  private async persistUpdates(documentId: string, room: Room) {
    if (room.pendingUpdates.length === 0) return;

    const mergedUpdate = Y.mergeUpdates(room.pendingUpdates);
    room.pendingUpdates = [];

    try {
      await this.prisma.yjsUpdate.create({
        data: {
          documentId,
          update: Buffer.from(mergedUpdate),
        },
      });

      await this.compactUpdatesIfNeeded(documentId);

      this.logger.debug(`Persisted update for document ${documentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to persist updates for document ${documentId}`,
        error,
      );
      room.pendingUpdates.push(mergedUpdate);
    }
  }

  private async compactUpdatesIfNeeded(documentId: string) {
    const count = await this.prisma.yjsUpdate.count({
      where: { documentId },
    });

    if (count < 50) return;

    const allUpdates = await this.prisma.yjsUpdate.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, update: true },
    });

    const merged = Y.mergeUpdates(
      allUpdates.map((u) => new Uint8Array(u.update)),
    );

    await this.prisma.$transaction([
      this.prisma.yjsUpdate.deleteMany({ where: { documentId } }),
      this.prisma.yjsUpdate.create({
        data: {
          documentId,
          update: Buffer.from(merged),
        },
      }),
    ]);

    this.logger.log(
      `Compacted ${allUpdates.length} updates into 1 for document ${documentId}`,
    );
  }

  private async loadDocumentState(documentId: string, doc: Y.Doc) {
    const updates = await this.prisma.yjsUpdate.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
      select: { update: true },
    });

    if (updates.length > 0) {
      const merged = Y.mergeUpdates(
        updates.map((u) => new Uint8Array(u.update)),
      );
      Y.applyUpdate(doc, merged);
      this.logger.log(
        `Loaded ${updates.length} updates for document ${documentId}`,
      );
    }
  }

  private async cleanupRoom(documentId: string) {
    const room = this.rooms.get(documentId);
    if (!room || room.connections.size > 0) return;

    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
      room.persistTimer = null;
    }

    await this.persistUpdates(documentId, room);
    room.doc.destroy();
    this.rooms.delete(documentId);

    this.logger.log(`Room cleaned up for document ${documentId}`);
  }
}
