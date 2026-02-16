import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { WsEvent } from '@realtime-collab/shared';
import { CollaborationService } from './collaboration.service';
import { WsAuthGuard } from '../auth/ws-auth.guard';

@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private clientRooms = new Map<string, string>();

  constructor(private collaborationService: CollaborationService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const documentId = this.clientRooms.get(client.id);
    if (documentId) {
      this.collaborationService.removeConnection(documentId, client.id);
      this.clientRooms.delete(client.id);

      client.to(documentId).emit(WsEvent.AwarenessUpdate, {
        clientId: client.id,
        removed: true,
      });
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WsEvent.JoinDocument)
  async handleJoinDocument(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { documentId: string },
  ) {
    const { documentId } = data;

    const previousRoom = this.clientRooms.get(client.id);
    if (previousRoom) {
      client.leave(previousRoom);
      this.collaborationService.removeConnection(previousRoom, client.id);
    }

    try {
      const room = await this.collaborationService.getOrCreateRoom(documentId);
      client.join(documentId);
      this.clientRooms.set(client.id, documentId);
      this.collaborationService.addConnection(documentId, client.id);

      const stateVector = Y.encodeStateVector(room.doc);
      client.emit(WsEvent.DocumentJoined, { documentId });
      client.emit(WsEvent.SyncStep1, {
        stateVector: Array.from(stateVector),
      });

      this.logger.log(
        `Client ${client.id} joined document ${documentId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to join document ${documentId}`, error);
      client.emit(WsEvent.DocumentError, {
        message: 'Failed to join document',
      });
    }
  }

  @SubscribeMessage(WsEvent.SyncStep1)
  handleSyncStep1(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { stateVector: number[] },
  ) {
    const documentId = this.clientRooms.get(client.id);
    if (!documentId) return;

    const remoteStateVector = new Uint8Array(data.stateVector);
    const diff = this.collaborationService.getStateDiff(
      documentId,
      remoteStateVector,
    );

    if (diff) {
      client.emit(WsEvent.SyncStep2, {
        update: Array.from(diff),
      });
    }
  }

  @SubscribeMessage(WsEvent.SyncStep2)
  handleSyncStep2(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { update: number[] },
  ) {
    const documentId = this.clientRooms.get(client.id);
    if (!documentId) return;

    const update = new Uint8Array(data.update);
    this.collaborationService.applyUpdate(documentId, update);
  }

  @SubscribeMessage(WsEvent.Update)
  handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { update: number[] },
  ) {
    const documentId = this.clientRooms.get(client.id);
    if (!documentId) return;

    const update = new Uint8Array(data.update);
    this.collaborationService.applyUpdate(documentId, update);

    client.to(documentId).emit(WsEvent.Update, {
      update: data.update,
    });
  }

  @SubscribeMessage(WsEvent.AwarenessUpdate)
  handleAwarenessUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const documentId = this.clientRooms.get(client.id);
    if (!documentId) return;

    client.to(documentId).emit(WsEvent.AwarenessUpdate, {
      clientId: client.id,
      ...data,
    });
  }

  @SubscribeMessage(WsEvent.AwarenessQuery)
  handleAwarenessQuery(@ConnectedSocket() client: Socket) {
    const documentId = this.clientRooms.get(client.id);
    if (!documentId) return;

    client.to(documentId).emit(WsEvent.AwarenessQuery, {
      clientId: client.id,
    });
  }
}
