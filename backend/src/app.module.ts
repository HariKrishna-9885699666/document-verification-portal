/**
 * DVP Backend - Root Application Module
 *
 * This module imports all feature modules and global providers.
 * Order matters for module initialization:
 *   1. ConfigModule - loads .env variables first
 *   2. EventEmitterModule - in-app event system for notifications
 *   3. DatabaseModule - TypeORM + PostgreSQL connection
 *   4. Feature modules - Auth, Documents, Admin, Audit, Notifications
 *   5. AwsModule - S3 + EventBridge clients (pointed at Floci locally)
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AwsModule } from './common/aws';

@Module({
  imports: [
    // Load .env file and make env vars available across the app
    ConfigModule.forRoot(),

    // In-process event system used by NotificationsService
    EventEmitterModule.forRoot(),

    // TypeORM with PostgreSQL (entities: User, Document, AuditLog)
    DatabaseModule,

    // Feature modules (each registers its own controllers + services)
    AuthModule,            // POST /api/auth/register, /api/auth/login
    DocumentsModule,       // Document CRUD + S3 presigned URLs
    AdminModule,           // Admin review: approve/reject documents
    AuditModule,           // Immutable audit trail for all state changes
    NotificationsModule,   // In-app notification dispatching

    // AWS service clients (S3, EventBridge) — pointed at Floci locally
    AwsModule,
  ],
})
export class AppModule {}
