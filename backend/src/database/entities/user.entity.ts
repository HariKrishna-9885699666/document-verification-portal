/**
 * User Entity - Maps to the 'users' table in PostgreSQL.
 *
 * Stores user accounts with role-based access control.
 * Password hashes are stored using bcrypt (never plaintext).
 *
 * Relationships:
 *   - One user has many documents (OneToMany)
 *   - One user has many audit log entries (OneToMany)
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../../common/enums';
import { Document } from './document.entity';
import { AuditLog } from './audit-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 50, default: Role.USER })
  role: Role;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Document, (doc) => doc.user)
  documents: Document[];

  @OneToMany(() => AuditLog, (log) => log.performedBy)
  auditLogs: AuditLog[];
}
