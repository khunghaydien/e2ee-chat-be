import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Index('idx_conversations_type_updated_id', ['type', 'updatedAt', 'id'])
@Index('idx_conversations_updated_id', ['updatedAt', 'id'])
@Entity('conversations')
export class ConversationEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: ['PRIVATE', 'GROUP'],
        name: 'type',
        nullable: false,
        default: 'PRIVATE',
    })
    type: 'PRIVATE' | 'GROUP';

    @Column({ type: 'varchar', name: 'title', length: 255, nullable: true })
    title: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt: Date | null;

}

