import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  NotificationEventType,
  LinkCreatedPayload,
  PaymentDetectedPayload,
  UsernameClaimedPayload,
} from '../events/notification.events';

export interface NotificationTransport {
  send(event: NotificationEventType, payload: any): Promise<void>;
}

@Injectable()
export class LogNotificationTransport implements NotificationTransport {
  private readonly logger = new Logger('NotificationTransport');
  async send(event: NotificationEventType, payload: any): Promise<void> {
    this.logger.log(`[Stub] Notification: ${event}`);
    this.logger.debug(`Payload: ${JSON.stringify(payload)}`);
  }
}

@Injectable()
export class NotificationService {
  constructor(private readonly transport: LogNotificationTransport) {}

  @OnEvent(NotificationEventType.LinkCreated, { async: true })
  async handleLinkCreated(payload: LinkCreatedPayload) {
    await this.transport.send(NotificationEventType.LinkCreated, payload);
  }

  @OnEvent(NotificationEventType.PaymentDetected, { async: true })
  async handlePaymentDetected(payload: PaymentDetectedPayload) {
    await this.transport.send(NotificationEventType.PaymentDetected, payload);
  }

  @OnEvent(NotificationEventType.UsernameClaimed, { async: true })
  async handleUsernameClaimed(payload: UsernameClaimedPayload) {
    await this.transport.send(NotificationEventType.UsernameClaimed, payload);
  }
}
