/**
 * JwtStrategy - Passport JWT Authentication Strategy
 *
 * Extracts the JWT token from the Authorization header (Bearer scheme),
 * verifies the signature, and loads the corresponding user from the database.
 *
 * If the token is valid and the user exists, the user object is attached
 * to request.user for use in controllers and guards.
 *
 * @see JwtAuthGuard - Guard that activates this strategy
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../database/entities';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      // Extract JWT from "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Reject expired tokens
      ignoreExpiration: false,

      // Must match the secret used in AuthModule to sign tokens
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    });
  }

  /**
   * Called by Passport after the JWT is verified.
   * Loads the full user from the database to ensure they still exist.
   *
   * @param payload - Decoded JWT payload { sub, email, role }
   * @returns User object (attached to request.user)
   * @throws UnauthorizedException if user no longer exists
   */
  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return { id: user.id, email: user.email, role: user.role };
  }
}
