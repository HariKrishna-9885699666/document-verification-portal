/**
 * RolesGuard - Role-Based Access Control Guard
 *
 * Checks the user's role (attached to request.user by JwtStrategy) against
 * the roles required by the @Roles decorator on the route handler.
 *
 * Must be used with JwtAuthGuard (the roles are read from the JWT payload).
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(Role.ADMIN)
 *   @Get('admin-only')
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './enums';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get the roles required by the @Roles decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles) return true;

    // Check if the user's role is in the required roles list
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
