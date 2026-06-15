/**
 * DVP Backend - AWS Lambda Handler
 *
 * This is the entry point for AWS Lambda deployment via the Serverless Framework.
 * It wraps the NestJS application with serverless-http so that API Gateway
 * events are translated into standard Express/NestJS requests and vice versa.
 *
 * The first invocation cold-starts the NestJS application and caches it for
 * subsequent warm invocations (global variable reuse pattern).
 *
 * For local development, use src/main.ts directly (npm run start:dev).
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import serverless from 'serverless-http';
import { Context } from 'aws-lambda';
import { AppModule } from './app.module';

// Cached server instance reused across Lambda warm invocations
// This avoids cold-start overhead on subsequent calls
let cachedServer: ReturnType<typeof serverless>;

/**
 * Initializes the NestJS application and wraps it in a serverless-http handler.
 * Called once on the first Lambda invocation, then cached.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Must match the prefix used in API Gateway routes
  app.setGlobalPrefix('api');

  await app.init();

  // Extract the underlying Express instance and wrap it for Lambda
  const expressApp = app.getHttpAdapter().getInstance();
  return serverless(expressApp);
}

/**
 * AWS Lambda entry point.
 * - Cold start: bootstraps NestJS, then handles the event
 * - Warm start: reuses the cached server instance
 *
 * @param event  - API Gateway HTTP event
 * @param context - Lambda execution context
 */
export const handler = async (event: any, context: Context) => {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  return cachedServer(event, context);
};
