import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import {
  ConversationEntity,
  ConversationParticipantEntity,
  UserEntity,
} from '@app/database';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { MessageEntity } from '@app/database/entities/messages.entity';

const DEFAULT_CONVERSATIONS_LIMIT = 20;
const DEFAULT_MESSAGES_LIMIT = 50;
const MAX_LIMIT = 100;

export interface ListConversationsResult {
  items: ConversationEntity[];
  nextCursor: string | null;
}

export interface MessageWithSender extends MessageEntity {
  sender: { id: string; userName: string; publicKey: string } | null;
}

export interface ListMessagesResult {
  items: MessageWithSender[];
  nextCursor: string | null;
}

/**
 * Service layer: kiểm tra quyền, truy vấn DB, không chứa WebSocket emit.
 * Chỉ dùng TypeORM find / findOne / save / update / count, không dùng QueryBuilder.
 */
@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    @InjectRepository(ConversationParticipantEntity)
    private readonly participantRepo: Repository<ConversationParticipantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Danh sách hội thoại user tham gia, sắp theo hoạt động gần nhất.
   * Filter theo participant, cursor pagination (updatedAt, id).
   */
  async getConversations(
    userId: string,
    query: ListConversationsQueryDto = {},
  ): Promise<ListConversationsResult> {
    const limit = Math.min(
      query.limit ?? DEFAULT_CONVERSATIONS_LIMIT,
      MAX_LIMIT,
    );

    const participants = await this.participantRepo.find({
      where: { userId },
      select: ['conversationId'],
    });
    const conversationIds = participants.map((p) => p.conversationId);
    if (conversationIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    let where: object = { id: In(conversationIds) };

    if (query.cursor?.trim()) {
      const cursorConv = await this.conversationRepo.findOne({
        where: { id: query.cursor.trim() },
        select: ['updatedAt'],
      });
      if (cursorConv) {
        where = {
          id: In(conversationIds),
          updatedAt: LessThan(cursorConv.updatedAt),
        };
      }
    }

    const items = await this.conversationRepo.find({
      where,
      order: { updatedAt: 'DESC', id: 'DESC' },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const list = hasMore ? items.slice(0, limit) : items;
    const nextCursor =
      hasMore && list.length > 0 ? list[list.length - 1].id : null;

    return { items: list, nextCursor };
  }

  /**
   * Bắt buộc kiểm tra quyền: user phải là participant của conversation.
   * Mọi API đọc/gửi message phải gọi trước.
   */
  async assertUserInConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const count = await this.participantRepo.count({
      where: { userId, conversationId },
    });
    if (count === 0) {
      throw new ForbiddenException('You are not in this conversation');
    }
  }

  /**
   * Danh sách messages theo conversation, lấy sender (id, userName, publicKey) bằng find users rồi map.
   * Cursor pagination (createdAt, id). Gọi assertUserInConversation trước khi dùng.
   */
  async getMessages(
    conversationId: string,
    query: ListMessagesQueryDto = {},
  ): Promise<ListMessagesResult> {
    const limit = Math.min(
      query.limit ?? DEFAULT_MESSAGES_LIMIT,
      MAX_LIMIT,
    );

    let where: object = { conversationId };

    if (query.cursor?.trim()) {
      const cursorMsg = await this.messageRepo.findOne({
        where: { id: query.cursor.trim() },
        select: ['createdAt'],
      });
      if (cursorMsg) {
        where = {
          conversationId,
          createdAt: LessThan(cursorMsg.createdAt),
        };
      }
    }

    const list = await this.messageRepo.find({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit + 1,
    });

    const hasMore = list.length > limit;
    const items = hasMore ? list.slice(0, limit) : list;
    const nextCursor =
      hasMore && items.length > 0 ? items[items.length - 1].id : null;

    const senderIds = [...new Set(items.map((m) => m.senderId))];
    const users =
      senderIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(senderIds) },
            select: ['id', 'userName', 'publicKey'],
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const itemsWithSender: MessageWithSender[] = items.map((m) => ({
      ...m,
      sender: userMap.get(m.senderId)
        ? {
            id: userMap.get(m.senderId)!.id,
            userName: userMap.get(m.senderId)!.userName,
            publicKey: userMap.get(m.senderId)!.publicKey,
          }
        : null,
    }));

    return { items: itemsWithSender, nextCursor };
  }

  /**
   * Gửi message: kiểm tra quyền, lưu DB, cập nhật conversation.updated_at.
   * Lấy thông tin sender (id, userName, publicKey) để gateway emit. Gateway sẽ emit 'new_message' sau khi gọi method này.
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    content: string,
  ): Promise<MessageEntity & { sender: { id: string; userName: string; publicKey: string } }> {
    await this.assertUserInConversation(userId, conversationId);

    const msg = this.messageRepo.create({
      conversationId,
      senderId: userId,
      content,
    });
    const saved = await this.messageRepo.save(msg);

    await this.conversationRepo.update(conversationId, {
      updatedAt: new Date(),
    });

    const sender = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'userName', 'publicKey'],
    });
    if (!sender) {
      return { ...saved, sender: { id: userId, userName: '', publicKey: '' } };
    }
    return { ...saved, sender: { id: sender.id, userName: sender.userName, publicKey: sender.publicKey } };
  }

  /**
   * Danh sách participants của conversation (id, userName, publicKey). Dùng cho E2EE lấy public key đối phương.
   */
  async getParticipants(
    userId: string,
    conversationId: string,
  ): Promise<{ id: string; userName: string; publicKey: string }[]> {
    await this.assertUserInConversation(userId, conversationId);
    const participants = await this.participantRepo.find({
      where: { conversationId },
      select: ['userId'],
    });
    const userIds = participants.map((p) => p.userId);
    const users = await this.userRepo.find({
      where: { id: In(userIds) },
      select: ['id', 'userName', 'publicKey'],
    });
    return users.map((u) => ({
      id: u.id,
      userName: u.userName,
      publicKey: u.publicKey,
    }));
  }

  /**
   * Lấy danh sách userId của các participant trong conversation (dùng cho gateway emit conversation_updated).
   */
  async getParticipantUserIds(conversationId: string): Promise<string[]> {
    const rows = await this.participantRepo.find({
      where: { conversationId },
      select: ['userId'],
    });
    return rows.map((r) => r.userId);
  }

  /**
   * Lấy danh sách conversation_id mà user tham gia (dùng cho WebSocket join room).
   */
  async getConversationIdsByUserId(userId: string): Promise<string[]> {
    const rows = await this.participantRepo.find({
      where: { userId },
      select: ['conversationId'],
    });
    return rows.map((r) => r.conversationId);
  }

  /**
   * Tạo conversation PRIVATE 1-1: participantIds = [otherUserId].
   * Nếu đã tồn tại conversation PRIVATE giữa 2 user thì trả về luôn.
   */
  async createConversation(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationEntity> {
    const type = dto.type ?? 'PRIVATE';
    if (type === 'PRIVATE') {
      if (dto.participantIds.length !== 1) {
        throw new BadRequestException(
          'PRIVATE conversation must have exactly one other participant',
        );
      }
      const otherUserId = dto.participantIds[0];
      if (otherUserId === userId) {
        throw new BadRequestException('Cannot create conversation with yourself');
      }
      const existing = await this.findPrivateConversationBetween(userId, otherUserId);
      if (existing) return existing;

      const conv = this.conversationRepo.create({
        type: 'PRIVATE' as const,
        updatedAt: new Date(),
      });
      const saved = await this.conversationRepo.save(conv);
      await this.participantRepo.save([
        this.participantRepo.create({
          conversationId: saved.id,
          userId,
          updatedAt: new Date(),
        }),
        this.participantRepo.create({
          conversationId: saved.id,
          userId: otherUserId,
          updatedAt: new Date(),
        }),
      ]);
      return saved;
    }
    throw new BadRequestException('Only PRIVATE type is supported');
  }

  private async findPrivateConversationBetween(
    userId1: string,
    userId2: string,
  ): Promise<ConversationEntity | null> {
    const participants = await this.participantRepo.find({
      where: { userId: In([userId1, userId2]) },
      select: ['conversationId', 'userId'],
    });
    const byConv = new Map<string, Set<string>>();
    for (const p of participants) {
      if (!byConv.has(p.conversationId)) {
        byConv.set(p.conversationId, new Set());
      }
      byConv.get(p.conversationId)!.add(p.userId);
    }
    const convIdsWithTwo = [...byConv.entries()]
      .filter(([, userIds]) => userIds.size === 2)
      .map(([id]) => id);
    if (convIdsWithTwo.length === 0) return null;
    const conv = await this.conversationRepo.findOne({
      where: { id: In(convIdsWithTwo), type: 'PRIVATE' },
    });
    return conv;
  }
}
