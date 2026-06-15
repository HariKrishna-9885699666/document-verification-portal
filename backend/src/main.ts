/**
 * DVP Backend - Application Entry Point
 *
 * This is the standard HTTP server bootstrap for local development.
 * It creates a NestJS application with CORS, global validation pipes,
 * and an /api prefix for all routes.
 *
 * For AWS Lambda deployment, see src/handler.ts which uses serverless-http
 * to wrap the same NestJS application.
 *
 * @see src/handler.ts - Lambda-compatible entry point
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create the root NestJS application module
  const app = await NestFactory.create(AppModule);

  // Enable CORS so the frontend (localhost:3000) can call the API
  // In production, restrict this to your actual frontend domain
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation: strip unknown properties, throw on unexpected inputs
  // This ensures all API inputs are validated by controller-level DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strip properties without decorators
      forbidNonWhitelisted: true,   // Throw error on unknown properties
    }),
  );

  // All API routes are prefixed with /api (e.g., /api/auth/login)
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`DVP Backend running on http://localhost:${port}`);
}

bootstrap();
