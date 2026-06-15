/**
 * JwtAuthGuard - Authentication Guard
 *
 * Protects routes by requiring a valid JWT token.
 * Uses the JwtStrategy to validate the token and load the user.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('protected-route')
 *   myMethod() { ... }
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
