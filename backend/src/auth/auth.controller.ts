/**
 * AuthController - Authentication REST Endpoints
 *
 * Exposes public endpoints for user registration and login.
 * Both endpoints return a JWT token that must be included in the
 * Authorization header (Bearer token) for authenticated requests.
 *
 * Endpoints:
 *   POST /api/auth/register - Create a new user account
 *   POST /api/auth/login    - Authenticate and receive JWT token
 */

import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register a new user.
   * Body: { name: string, email: string, password: string }
   * Response: { user: { id, name, email, role }, token: string }
   */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Login an existing user.
   * Body: { email: string, password: string }
   * Response: { user: { id, name, email, role }, token: string }
   */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
