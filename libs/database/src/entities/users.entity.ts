import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class UserEntity extends BaseEntity {

    @Column({ type: 'varchar', length: 255, unique: true, name: 'user_name', nullable: false })
    userName: string;

    @Column({ type: 'varchar', length: 255, name: 'password', nullable: false })
    password: string;

    @Column({ type: 'varchar', length: 255, name: 'public_key', nullable: false, unique: true })
    publicKey: string;
}
