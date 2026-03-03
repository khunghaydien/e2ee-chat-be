import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConversationsService } from '@app/conversations';
import { Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';

const CONV_ROOM_PREFIX = 'conv:';
const USER_ROOM_PREFIX = 'user:';

/**
 * Realtime layer: Socket join room theo conversationId.
 * Chỉ user trong conversation (DB xác nhận) mới join được room.
 * Emit new_message chỉ tới room conv:{conversationId}.
 * CORS: cho phép mọi origin (origin: true).
 */

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/',
})
export class ConversationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ConversationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly conversationsService: ConversationsService,
  ) { }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET || 'default-jwt-secret',
      });
      const userId = payload.sub;

      const conversationIds =
        await this.conversationsService.getConversationIdsByUserId(userId);
      for (const cid of conversationIds) {
        client.join(`${CONV_ROOM_PREFIX}${cid}`);
      }
      client.join(`${USER_ROOM_PREFIX}${userId}`);

      (client as Socket & { userId?: string }).userId = userId;
      this.logger.debug(`Client ${client.id} joined ${conversationIds.length} rooms`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected`);
  }

  /**
   * Client gửi join_conversation(conversationId) để join room (dùng khi mở conversation
   * hoặc khi conversation mới tạo sau lúc connect — đảm bảo nhận new_message realtime).
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    client: Socket,
    payload: string | { conversationId: string },
  ): Promise<{ ok?: boolean; error?: string }> {
    const userId = (client as Socket & { userId?: string }).userId;
    if (!userId) {
      return { error: 'Unauthorized' };
    }
    const conversationId =
      typeof payload === 'string' ? payload : payload?.conversationId;
    if (!conversationId || typeof conversationId !== 'string') {
      return { error: 'conversationId required' };
    }
    try {
      await this.conversationsService.assertUserInConversation(userId, conversationId);
      client.join(`${CONV_ROOM_PREFIX}${conversationId}`);
      return { ok: true };
    } catch {
      return { error: 'Forbidden' };
    }
  }

  /**
   * Emit new_message tới room conv:conversationId và conversation_updated tới từng user room
   * để FE cập nhật conversation list (kể cả user chưa join room conv).
   */
  async broadcastNewMessage(
    conversationId: string,
    msg: { id: string; conversationId: string; senderId: string; content: string; createdAt: Date } & { sender: { id: string; userName: string; publicKey: string } },
  ): Promise<void> {
    this.server.to(`${CONV_ROOM_PREFIX}${conversationId}`).emit('new_message', msg);
    const userIds = await this.conversationsService.getParticipantUserIds(conversationId);
    for (const uid of userIds) {
      this.server.to(`${USER_ROOM_PREFIX}${uid}`).emit('conversation_updated', { conversationId });
    }
  }

  /**
   * Khi tạo conversation mới, notify từng participant để FE refetch conversation list.
   */
  async notifyConversationCreated(conversationId: string): Promise<void> {
    const userIds = await this.conversationsService.getParticipantUserIds(conversationId);
    for (const uid of userIds) {
      this.server.to(`${USER_ROOM_PREFIX}${uid}`).emit('conversation_updated', { conversationId });
    }
  }

  /**
   * Event send_message: conversationId, content.
   * Service kiểm tra quyền + lưu DB + cập nhật conversation.
   * Gateway emit new_message tới room conv:{conversationId}.
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    client: Socket,
    payload: { conversationId: string; content: string },
  ) {
    const userId = (client as Socket & { userId?: string }).userId;
    if (!userId) {
      return { error: 'Unauthorized' };
    }
    const conversationId = payload.conversationId;
    const content = payload.content?.trim();
    if (!conversationId || !content) {
      return { error: 'conversationId and content required' };
    }

    try {
      const msg = await this.conversationsService.sendMessage(
        userId,
        conversationId,
        content,
      );
      const emitPayload = {
        ...msg,
        sender: msg.sender
      };
      await this.broadcastNewMessage(conversationId, emitPayload);
      return { message: emitPayload };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
}
