import { Entity, Column, DeleteDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('conversation_participants')
export class ConversationParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column({ type: 'uuid', name: 'conversation_id', nullable: false })
  conversationId: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: false })
  userId: string;

  @Column({ type: 'timestamp', name: 'joined_at', nullable: false, default: () => 'now()' })
  joinedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}