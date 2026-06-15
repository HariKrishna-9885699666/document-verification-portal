/**
 * DatabaseModule - TypeORM + PostgreSQL Configuration
 *
 * Configures the database connection using environment variables.
 * In local development, connects to a local or Docker PostgreSQL instance.
 * In production (AWS), this would connect to Amazon RDS.
 *
 * Uses TypeORM with synchronize: true for local development (auto-creates tables).
 * In production, use migrations instead of synchronize.
 *
 * This module is @Global() so repositories are available app-wide.
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Document, AuditLog } from './entities';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432', 10),
        username: process.env.DATABASE_USER || 'dvp_user',
        password: process.env.DATABASE_PASSWORD || 'dvp_pass',
        database: process.env.DATABASE_NAME || 'dvp_db',
        entities: [User, Document, AuditLog],

        // Auto-create tables in development. Use migrations in production.
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([User, Document, AuditLog]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
