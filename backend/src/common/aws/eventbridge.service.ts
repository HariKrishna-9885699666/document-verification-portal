/**
 * EventBridgeService - Amazon EventBridge Interaction Layer
 *
 * Publishes domain events that drive the document verification workflow:
 *   - DocumentUploaded       -> triggers OCR processing
 *   - OCRCompleted           -> marks document ready for admin review
 *   - VerificationCompleted  -> final approval/rejection event
 *
 * In local development, events are sent to Floci's EventBridge emulator.
 * In production, they go to real AWS EventBridge and can trigger downstream
 * processors (e.g., Lambda functions, Step Functions, SQS queues).
 *
 * Event structure (as defined in the PRD):
 *   {
 *     "source": "dvp.document",
 *     "detail-type": "DocumentUploaded",
 *     "detail": { "documentId": "uuid" }
 *   }
 */

import { Injectable } from '@nestjs/common';

// Enumeration of all domain events in the DVP workflow
export type DvpEventType = 'DocumentUploaded' | 'OCRCompleted' | 'VerificationCompleted';

@Injectable()
export class EventBridgeService {
  private readonly endpoint: string;
  private readonly region: string;
  private readonly eventBusName = 'default';

  constructor() {
    this.endpoint = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
    this.region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
  }

  /**
   * Publish a domain event to EventBridge.
   *
   * @param detailType - The type of event (maps to detail-type in EventBridge)
   * @param detail     - Event payload (must be serializable to JSON)
   */
  async putEvent(detailType: DvpEventType, detail: Record<string, any>): Promise<void> {
    const { EventBridgeClient, PutEventsCommand } = await import(
      '@aws-sdk/client-eventbridge'
    );

    const client = new EventBridgeClient({
      endpoint: this.endpoint,
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      },
    });

    await client.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'dvp.document',
            DetailType: detailType,
            Detail: JSON.stringify(detail),
            EventBusName: this.eventBusName,
          },
        ],
      }),
    );
  }
}
