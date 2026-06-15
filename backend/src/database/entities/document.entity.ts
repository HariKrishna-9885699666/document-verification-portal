/**
 * Document Entity - Maps to the 'documents' table in PostgreSQL.
 *
 * Stores uploaded document metadata and verification state.
 * The actual file content is stored in S3 (dvp-documents-raw bucket).
 * OCR-extracted data is stored in the ocr_data JSONB column for flexible querying.
 *
 * Status workflow:
 *   UPLOADED -> PROCESSING -> OCR_COMPLETED -> REVIEW_PENDING -> APPROVED / REJECTED
 *
 * Relationships:
 *   - Each document belongs to one user (ManyToOne)
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DocumentType } from '../../common/enums/document-type.enum';
import { DocumentStatus } from '../../common/enums/document-status.enum';
import { User } from './user.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'document_type', length: 50 })
  documentType: DocumentType;

  @Column({ length: 50, default: DocumentStatus.UPLOADED })
  status: DocumentStatus;

  @Column({ name: 's3_key', type: 'text', nullable: true })
  s3Key: string;

  @Column({ name: 'ocr_data', type: 'jsonb', nullable: true })
  ocrData: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.documents)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
