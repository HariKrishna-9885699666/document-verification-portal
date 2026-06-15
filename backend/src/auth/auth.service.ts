/**
 * AuthService - Authentication Business Logic
 *
 * Handles user registration and login with secure password hashing.
 * Uses bcryptjs (cost factor 12) for password storage and JWT for session tokens.
 */

import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../database/entities';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../common/enums';

@Injectable()
export class AuthService {
  constructor(
    // TypeORM repository for User entity
    @InjectRepository(User)
    private userRepository: Repository<User>,

    // NestJS JWT service for signing tokens
    private jwtService: JwtService,
  ) {}

  /**
   * Register a new user account.
   * - Checks for duplicate email addresses
   * - Hashes password with bcrypt (cost factor 12)
   * - Assigns USER role by default (or provided role for admin-created accounts)
   * - Returns user info + JWT token
   *
   * @param dto - Registration payload (name, email, password, optional role)
   * @returns Newly created user (without password hash) and JWT token
   * @throws ConflictException if email already exists
   */
  async register(dto: RegisterDto) {
    // Check for existing user with the same email
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password with bcrypt (cost 12 = ~250ms per hash on modern hardware)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create and persist the user record
    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role || Role.USER,
    });
    await this.userRepository.save(user);

    // Generate JWT and return (never expose passwordHash to clients)
    const token = this.generateToken(user);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    };
  }

  /**
   * Authenticate an existing user.
   * - Looks up user by email
   * - Verifies password against stored bcrypt hash
   * - Returns user info + JWT token
   *
   * @param dto - Login payload (email, password)
   * @returns Authenticated user info and JWT token
   * @throws UnauthorizedException if credentials are invalid
   */
  async login(dto: LoginDto) {
    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Compare password against stored hash
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    };
  }

  /**
   * Generate a signed JWT token for the given user.
   * The payload includes:
   *   - sub: user ID (standard JWT subject claim)
   *   - email: user email for quick context
   *   - role: user role for authorization decisions
   *
   * @param user - The authenticated user entity
   * @returns Signed JWT string
   */
  private generateToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
