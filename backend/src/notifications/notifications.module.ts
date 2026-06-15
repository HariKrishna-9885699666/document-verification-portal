/**
 * NotificationsModule - In-App Notification System (FR7)
 *
 * Provides an event-driven notification system for:
 *   - Upload success notifications
 *   - Document approved/rejected alerts
 *   - Retry required notifications
 *
 * Currently supports in-app dispatching via NestJS EventEmitter.
 * Future enhancement: email notifications via SES.
 *
 * This module is @Global() so NotificationsService is available app-wide.
 */

import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
