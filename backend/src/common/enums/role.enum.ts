/**
 * Role Enum - User Access Levels
 *
 * Defines the three roles in the DVP system:
 *   USER        - Regular end-user: uploads documents, checks status
 *   ADMIN       - Verifier: reviews pending documents, approves/rejects
 *   SUPER_ADMIN - System manager: manages users, rules, and workflows
 */

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}
