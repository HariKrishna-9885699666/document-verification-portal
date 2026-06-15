/**
 * AuditService - Audit Trail Recording
 *
 * Provides methods to:
 *   - Log actions to the immutable audit_logs table
 *   - Query audit history for a specific entity
 *
 * Usage example in any service:
 *   this.auditService.log('document', docId, 'APPROVED', userId);
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  /**
   * Record an audit log entry.
   *
   * @param entityType    - Type of resource (e.g., 'document', 'user')
   * @param entityId      - UUID of the resource
   * @param action        - Description of the action (e.g., 'UPLOADED', 'APPROVED')
   * @param performedById - UUID of the user who performed the action
   */
  async log(
    entityType: string,
    entityId: string,
    action: string,
    performedById: string,
  ) {
    const log = this.auditRepository.create({
      entityType,
      entityId,
      action,
      performedById,
    });
    return this.auditRepository.save(log);
  }

  /**
   * Get the full audit trail for a specific entity, ordered chronologically.
   *
   * @param entityType - Type of resource
   * @param entityId   - UUID of the resource
   * @returns Array of audit log entries with performer info
   */
  async findByEntity(entityType: string, entityId: string) {
    return this.auditRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
      relations: ['performedBy'],
    });
  }
}
