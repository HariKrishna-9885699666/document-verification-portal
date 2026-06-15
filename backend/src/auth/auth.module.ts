/**
 * AuthModule - Authentication & Authorization
 *
 * Implements FR1 from the PRD:
 *   - User registration with bcrypt password hashing
 *   - Login with JWT token issuance
 *   - Role-based access control (USER, ADMIN, SUPER_ADMIN)
 *
 * Uses Passport.js with JWT strategy for stateless authentication.
 * Tokens are signed with HMAC-SHA256 and expire after 24 hours.
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../database/entities';

@Module({
  imports: [
    // Register the User entity with TypeORM for database operations
    TypeOrmModule.forFeature([User]),

    // Standard Passport setup
    PassportModule,

    // JWT configuration: sign tokens with a secret and set expiration
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,    // Business logic for register/login
    JwtStrategy,    // Passport strategy that validates JWT from Authorization header
  ],
  exports: [AuthService],
})
export class AuthModule {}
