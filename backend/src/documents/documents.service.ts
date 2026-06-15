/**
 * DocumentsService - Document Business Logic
 *
 * Manages the complete document lifecycle:
 *   1. Create document record + generate presigned S3 upload URL
 *   2. Fire DocumentUploaded EventBridge event to trigger OCR pipeline
 *   3. Query documents for listing and detail views
 *   4. Update OCR data when the worker completes processing
 *   5. Track status transitions through the verification workflow
 *
 * Status workflow (as defined in PRD):
 *   UPLOADED -> PROCESSING -> OCR_COMPLETED -> REVIEW_PENDING -> APPROVED / REJECTED
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Document, User } from '../database/entities';
import { DocumentType, DocumentStatus } from '../common/enums';
import { S3Service } from '../common/aws/s3.service';
import { EventBridgeService } from '../common/aws/eventbridge.service';
import { RequestUploadUrlDto } from './dto/upload-url.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,

    // AWS S3 service for generating presigned upload URLs
    private s3Service: S3Service,

    // AWS EventBridge service for publishing workflow events
    private eventBridge: EventBridgeService,
  ) {}

  /**
   * Step 1 of the document upload flow:
   *   - Creates a document record in the database with status UPLOADED
   *   - Generates a presigned S3 URL for direct file upload
   *   - Fires a DocumentUploaded event to trigger the OCR workflow
   *
   * The frontend uses the returned uploadUrl to PUT the file directly to S3
   * without exposing AWS credentials. The OCR worker picks up the
   * DocumentUploaded event from EventBridge and processes the file.
   *
   * @param user - The authenticated user uploading the document
   * @param dto  - Upload request (documentType)
   * @returns Document metadata + presigned S3 upload URL
   */
  async requestUploadUrl(user: User, dto: RequestUploadUrlDto) {
    // Generate a unique document ID and S3 key
    const documentId = uuid();
    const s3Key = `${user.id}/${documentId}/original.pdf`;

    // Create the document record with initial status
    const doc = this.documentRepository.create({
      id: documentId,
      userId: user.id,
      documentType: dto.documentType,
      status: DocumentStatus.UPLOADED,
      s3Key,
    });
    await this.documentRepository.save(doc);

    // Generate presigned URL so frontend can upload directly to S3
    const uploadUrl = await this.s3Service.getSignedUploadUrl(s3Key);

    // Fire EventBridge event to trigger OCR processing pipeline
    await this.eventBridge.putEvent('DocumentUploaded', {
      documentId: doc.id,
      userId: user.id,
      s3Key,
    });

    return {
      documentId: doc.id,
      uploadUrl,
    };
  }

  /**
   * List all documents for the current user.
   * ADMIN/SUPER_ADMIN roles see all documents across all users.
   *
   * @param userId - The authenticated user's ID
   * @param role   - The authenticated user's role
   * @returns Array of document records
   */
  async listDocuments(userId: string, role: string) {
    // Regular users see only their own documents; admins see everything
    const where = role === 'USER' ? { userId } : {};
    return this.documentRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: role !== 'USER' ? ['user'] : [],
    });
  }

  /**
   * Get a single document by ID with full details including the user relation.
   *
   * @param id - Document UUID
   * @returns Document record with user relation
   * @throws NotFoundException if document doesn't exist
   */
  async getDocument(id: string) {
    const doc = await this.documentRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /**
   * Get the current verification status of a document.
   *
   * @param id - Document UUID
   * @returns Object with status field
   * @throws NotFoundException if document doesn't exist
   */
  async getStatus(id: string) {
    const doc = await this.documentRepository.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return { status: doc.status };
  }

  /**
   * Update the status of a document (used by the workflow engine).
   *
   * @param id     - Document UUID
   * @param status - New status value
   * @returns Updated document record
   */
  async updateStatus(id: string, status: DocumentStatus) {
    const doc = await this.documentRepository.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    doc.status = status;
    return this.documentRepository.save(doc);
  }

  /**
   * Update a document with OCR-extracted data.
   * Called by the OCR worker via PATCH /api/documents/:id/ocr.
   * Transitions status to OCR_COMPLETED and copies OCR JSON to S3 processed bucket.
   *
   * @param id      - Document UUID
   * @param ocrData - Extracted data (name, DOB, ID number, etc.)
   * @returns Updated document record
   */
  async updateOcrData(id: string, ocrData: Record<string, any>) {
    const doc = await this.documentRepository.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    // Store OCR data and advance status
    doc.ocrData = ocrData;
    doc.status = DocumentStatus.OCR_COMPLETED;
    const saved = await this.documentRepository.save(doc);

    // Copy OCR JSON to the processed S3 bucket for audit trail
    await this.s3Service.copyToProcessed(doc.s3Key!, ocrData);

    // Fire EventBridge event to notify downstream processors
    await this.eventBridge.putEvent('OCRCompleted', {
      documentId: doc.id,
      userId: doc.userId,
    });

    return saved;
  }
}
