/**
 * Roles Decorator - Role-Based Access Control Metadata
 *
 * Used with the RolesGuard to restrict endpoint access by user role.
 *
 * Usage:
 *   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
 *   @Get('admin-only')
 *   myMethod() { ... }
 *
 * @param roles - One or more roles that are allowed to access the endpoint
 */

import { SetMetadata } from '@nestjs/common';
import { Role } from './enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
