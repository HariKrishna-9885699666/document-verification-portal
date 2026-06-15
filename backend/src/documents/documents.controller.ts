/**
 * DocumentsController - Document REST Endpoints
 *
 * All endpoints require JWT authentication (JwtAuthGuard).
 *
 * Endpoints:
 *   POST   /api/documents/upload-url    - Request presigned S3 upload URL
 *   GET    /api/documents               - List documents
 *   GET    /api/documents/:id           - Get document details
 *   GET    /api/documents/:id/status    - Get verification status
 *   PATCH  /api/documents/:id/ocr       - Receive OCR results (from worker)
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { RequestUploadUrlDto } from './dto/upload-url.dto';
import { UpdateOcrDto } from './dto/update-ocr.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  /**
   * Request a presigned S3 upload URL for a new document.
   * Also creates the document record in UPLOADED status.
   */
  @Post('upload-url')
  requestUploadUrl(@Req() req, @Body() dto: RequestUploadUrlDto) {
    return this.documentsService.requestUploadUrl(req.user, dto);
  }

  /**
   * List all documents. Regular users see their own; admins see all.
   */
  @Get()
  listDocuments(@Req() req) {
    return this.documentsService.listDocuments(req.user.id, req.user.role);
  }

  /**
   * Get full document details including OCR data.
   */
  @Get(':id')
  getDocument(@Param('id') id: string) {
    return this.documentsService.getDocument(id);
  }

  /**
   * Quick status check (lightweight endpoint).
   */
  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.documentsService.getStatus(id);
  }

  /**
   * Internal endpoint called by the OCR worker to store extracted data.
   * Transitions document to OCR_COMPLETED status.
   */
  @Patch(':id/ocr')
  updateOcr(@Param('id') id: string, @Body() dto: UpdateOcrDto) {
    return this.documentsService.updateOcrData(id, dto.ocrData);
  }
}
