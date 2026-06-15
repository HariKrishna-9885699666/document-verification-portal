/**
 * DocumentType Enum - Supported Identity Documents
 *
 * As defined in the PRD (FR2), the system supports:
 *   AADHAAR         - Indian Aadhaar card (12-digit ID)
 *   PAN             - Permanent Account Number (10-char alphanumeric)
 *   PASSPORT        - Passport (various countries)
 *   DRIVING_LICENSE - Driving license
 *   CERTIFICATE     - Educational or other certificates
 */

export enum DocumentType {
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  PASSPORT = 'PASSPORT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  CERTIFICATE = 'CERTIFICATE',
}
