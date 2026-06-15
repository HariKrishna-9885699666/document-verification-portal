/**
 * DocumentStatus Enum - Verification Workflow States
 *
 * Defines the complete status workflow (FR3):
 *
 *   UPLOADED ──► PROCESSING ──► OCR_COMPLETED ──► REVIEW_PENDING ──► APPROVED
 *                                                                    └──► REJECTED
 *
 * Each status transition is immutable and tracked in the audit_logs table.
 */

export enum DocumentStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  OCR_COMPLETED = 'OCR_COMPLETED',
  REVIEW_PENDING = 'REVIEW_PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
