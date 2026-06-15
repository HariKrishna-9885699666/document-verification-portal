/**
 * AuditModule - Immutable Audit Trail (FR6)
 *
 * Records all state-changing operations in the system:
 *   - Document uploads
 *   - Status changes (UPLOADED -> PROCESSING -> OCR_COMPLETED -> etc.)
 *   - Admin actions (approve/reject)
 *   - System errors
 *
 * Each audit log entry captures:
 *   - Actor (who performed the action)
 *   - Action (what was done)
 *   - Entity type + ID (which resource was affected)
 *   - Timestamp (when it happened)
 *
 * This module is @Global() so AuditService is available app-wide without
 * importing AuditModule in every feature module.
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from '../database/entities';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
