/**
 * AuditLog Entity - Maps to the 'audit_logs' table in PostgreSQL.
 *
 * Provides an immutable audit trail of all state-changing operations.
 * Each record captures who did what, to which resource, and when.
 *
 * This table is append-only: records are never updated or deleted.
 * The created_at timestamp provides a complete chronological history.
 *
 * Relationships:
 *   - Each audit log references the user who performed the action (ManyToOne)
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_type', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id' })
  entityId: string;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'performed_by' })
  performedById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by' })
  performedBy: User;
}
