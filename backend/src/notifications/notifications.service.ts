/**
 * NotificationsService - Event-Driven Notification Dispatch
 *
 * Listens for domain events and dispatches in-app notifications.
 * Uses NestJS EventEmitter for decoupled communication between modules.
 *
 * Events handled:
 *   - notification.created -> dispatched to the user's notification feed
 *
 * Future: extend to send email via AWS SES or push via WebSockets.
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface NotificationEvent {
  /** The target user who should receive the notification */
  userId: string;

  /** Notification type (e.g., 'upload_success', 'approved', 'rejected') */
  type: string;

  /** Human-readable message */
  message: string;

  /** Optional document ID for deep-linking */
  documentId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * Dispatch a notification event through the in-app event system.
   *
   * @param event - The notification payload
   */
  async send(event: NotificationEvent) {
    this.eventEmitter.emit('notification.created', event);
  }
}
