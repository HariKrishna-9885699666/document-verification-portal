/**
 * AdminModule - Admin Review Dashboard (FR5)
 *
 * Provides endpoints for admins and super-admins to review pending documents.
 * All endpoints are protected by JwtAuthGuard + RolesGuard (ADMIN or SUPER_ADMIN).
 *
 * Endpoints:
 *   GET   /api/admin/documents/pending       - List documents awaiting review
 *   PATCH /api/admin/documents/:id/approve   - Approve a document
 *   PATCH /api/admin/documents/:id/reject    - Reject a document with remarks
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Document } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
