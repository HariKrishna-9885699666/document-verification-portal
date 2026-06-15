/**
 * AdminService - Admin Review Business Logic
 *
 * Allows admins to:
 *   - View all documents in REVIEW_PENDING status (sorted oldest-first)
 *   - Approve documents (transitions to APPROVED status)
 *   - Reject documents (transitions to REJECTED status with optional remarks)
 *
 * Each approval/rejection fires a VerificationCompleted EventBridge event
 * that can trigger notifications and other downstream processes.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../database/entities';
import { DocumentStatus } from '../common/enums';
import { EventBridgeService } from '../common/aws/eventbridge.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,

    // Publish VerificationCompleted events on approve/reject
    private eventBridge: EventBridgeService,
  ) {}

  /**
   * Get all documents awaiting admin review, ordered by oldest first (FIFO).
   *
   * @returns Array of documents in REVIEW_PENDING status with user relation
   */
  async getPendingDocuments() {
    return this.documentRepository.find({
      where: { status: DocumentStatus.REVIEW_PENDING },
      order: { createdAt: 'ASC' },
      relations: ['user'],
    });
  }

  /**
   * Approve a document and fire VerificationCompleted event.
   *
   * @param id      - Document UUID
   * @param remarks - Optional admin remarks
   * @returns Updated document record
   */
  async approveDocument(id: string, remarks?: string) {
    const doc = await this.documentRepository.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    doc.status = DocumentStatus.APPROVED;
    if (remarks) doc.remarks = remarks;
    const saved = await this.documentRepository.save(doc);

    // Notify downstream systems that verification is complete
    await this.eventBridge.putEvent('VerificationCompleted', {
      documentId: doc.id,
      userId: doc.userId,
      result: 'APPROVED',
    });

    return saved;
  }

  /**
   * Reject a document and fire VerificationCompleted event.
   *
   * @param id      - Document UUID
   * @param remarks - Reason for rejection
   * @returns Updated document record
   */
  async rejectDocument(id: string, remarks?: string) {
    const doc = await this.documentRepository.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    doc.status = DocumentStatus.REJECTED;
    if (remarks) doc.remarks = remarks;
    const saved = await this.documentRepository.save(doc);

    await this.eventBridge.putEvent('VerificationCompleted', {
      documentId: doc.id,
      userId: doc.userId,
      result: 'REJECTED',
    });

    return saved;
  }
}
