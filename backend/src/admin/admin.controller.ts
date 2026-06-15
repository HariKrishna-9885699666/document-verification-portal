/**
 * AdminController - Admin REST Endpoints
 *
 * Protected by both JwtAuthGuard (valid token required) and RolesGuard
 * (only ADMIN or SUPER_ADMIN roles allowed).
 *
 * Endpoints:
 *   GET   /api/admin/documents/pending       - List documents pending review
 *   PATCH /api/admin/documents/:id/approve   - Approve document
 *   PATCH /api/admin/documents/:id/reject    - Reject document with remarks
 */

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '../common/enums';
import { AdminService } from './admin.service';
import { ReviewDto } from './dto/review.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  /**
   * List all documents pending admin review.
   */
  @Get('documents/pending')
  getPending() {
    return this.adminService.getPendingDocuments();
  }

  /**
   * Approve a document.
   */
  @Patch('documents/:id/approve')
  approve(@Param('id') id: string, @Body() dto: ReviewDto) {
    return this.adminService.approveDocument(id, dto.remarks);
  }

  /**
   * Reject a document with optional remarks.
   */
  @Patch('documents/:id/reject')
  reject(@Param('id') id: string, @Body() dto: ReviewDto) {
    return this.adminService.rejectDocument(id, dto.remarks);
  }
}
