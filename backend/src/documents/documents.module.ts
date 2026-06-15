/**
 * DocumentsModule - Document Upload & Status Management
 *
 * Implements FR2 (Upload Documents) and FR3 (Verification Workflow) from the PRD.
 * Provides endpoints for:
 *   - Requesting presigned S3 upload URLs (POST /api/documents/upload-url)
 *   - Listing the current user's documents (GET /api/documents)
 *   - Getting document details (GET /api/documents/:id)
 *   - Checking document status (GET /api/documents/:id/status)
 *   - Receiving OCR results from the worker (PATCH /api/documents/:id/ocr)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
