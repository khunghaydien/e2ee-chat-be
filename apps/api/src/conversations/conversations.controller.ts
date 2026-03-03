import { Controller, Get, Param, Query, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, RequestUser } from '@app/common';
import { ConversationsGateway } from './conversations.gateway';
import {
  ConversationsService,
  CreateConversationDto,
  ListConversationsQueryDto,
  ListMessagesQueryDto,
  MessageWithSender,
  SendMessageDto,
} from '@app/conversations';

/** Message đã có sender an toàn (id, userName, publicKey) từ service. */
function toMessageResponse(msg: MessageWithSender) {
  const { sender, ...rest } = msg;
  return { ...rest, sender };
}

/**
 * Query layer: nhận request, không chứa logic nghiệp vụ.
 * Chỉ gọi service và trả về response.
 */
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly conversationsGateway: ConversationsGateway,
  ) {}

  /** Tạo conversation 1-1: body { participantIds: [otherUserId] } */
  @Post()
  async createConversation(
    @Body() dto: CreateConversationDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    const c = await this.conversationsService.createConversation(req.user.id, dto);
    await this.conversationsGateway.notifyConversationCreated(c.id);
    return { id: c.id, type: c.type, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt };
  }

  /** Danh sách hội thoại user tham gia (cursor pagination) */
  @Get()
  async listConversations(
    @Query() query: ListConversationsQueryDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    const userId = req.user.id;
    const result = await this.conversationsService.getConversations(userId, query);
    return {
      items: result.items.map((c) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      nextCursor: result.nextCursor,
    };
  }

  /** Danh sách participants (id, userName, publicKey) để FE lấy public key đối phương cho E2EE */
  @Get(':id/participants')
  async getParticipants(
    @Param('id') conversationId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    const list = await this.conversationsService.getParticipants(req.user.id, conversationId);
    return list.map((p) => ({ id: p.id, userName: p.userName, publicKey: p.publicKey }));
  }

  /** Gửi tin nhắn (REST). Body: { content }. Sau khi lưu sẽ emit new_message qua socket. */
  @Post(':id/messages')
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    const msg = await this.conversationsService.sendMessage(
      req.user.id,
      conversationId,
      dto.content,
    );
    await this.conversationsGateway.broadcastNewMessage(conversationId, msg);
    return toMessageResponse(msg);
  }

  /** Danh sách messages theo conversation (cursor pagination). Kiểm tra quyền trong service. */
  @Get(':id/messages')
  async listMessages(
    @Param('id') conversationId: string,
    @Query() query: ListMessagesQueryDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    const userId = req.user.id;
    await this.conversationsService.assertUserInConversation(
      userId,
      conversationId,
    );
    const result = await this.conversationsService.getMessages(
      conversationId,
      query,
    );
    return {
      items: result.items.map(toMessageResponse),
      nextCursor: result.nextCursor,
    };
  }
}
