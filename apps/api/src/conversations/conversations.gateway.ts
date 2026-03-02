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

/**
 * Realtime layer: Socket join room theo conversationId.
 * Chỉ user trong conversation (DB xác nhận) mới join được room.
 * Emit new_message chỉ tới room conv:{conversationId}.
 */
const wsCorsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

@WebSocketGateway({
  cors: { origin: wsCorsOrigins, credentials: true },
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
   * Emit new_message tới room (dùng khi gửi tin qua REST POST /conversations/:id/messages).
   */
  broadcastNewMessage(
    conversationId: string,
    msg: { id: string; conversationId: string; senderId: string; content: string; createdAt: Date } & { sender: { id: string; userName: string; publicKey: string } },
  ): void {
    this.server.to(`${CONV_ROOM_PREFIX}${conversationId}`).emit('new_message', msg);
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
      this.server.to(`${CONV_ROOM_PREFIX}${conversationId}`).emit('new_message', emitPayload);
      return { message: emitPayload };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
}
