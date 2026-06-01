import { Notification, KAFKA_TOPICS, EVENT_TYPES, EventEnvelope } from 'shared';
import EventBus from '../eventbus/eventbus.js';
import { v4 as uuidv4 } from 'uuid';

class NotificationService {
  private notifications: Notification[] = [];

  constructor() {
    this.setupSubscriptions();
    console.log('[NotificationService] Initialized. Subscribed to all Kafka topics.');
  }

  private setupSubscriptions() {
    // Listen to ride-events
    EventBus.subscribe(KAFKA_TOPICS.RIDE, (envelope) => this.handleRideEvents(envelope));
    // Listen to payment-events
    EventBus.subscribe(KAFKA_TOPICS.PAYMENT, (envelope) => this.handlePaymentEvents(envelope));
  }

  private handleRideEvents(envelope: EventEnvelope) {
    const { type, payload } = envelope;

    switch (type) {
      case EVENT_TYPES.RIDE_REQUESTED:
        this.sendNotification(
          payload.passengerId,
          `Your ride request has been received. Searching for nearby drivers...`,
          'PUSH'
        );
        break;

      case EVENT_TYPES.RIDE_ASSIGNED:
        this.sendNotification(
          payload.passengerId,
          `Driver ${payload.driverName} has accepted your ride! They are arriving in a ${payload.vehicle.color} ${payload.vehicle.make} ${payload.vehicle.model}.`,
          'PUSH'
        );
        this.sendNotification(
          payload.driverId,
          `You have been assigned to ride request from ${payload.passengerName}. Navigate to pickup!`,
          'PUSH'
        );
        break;

      case EVENT_TYPES.RIDE_ARRIVING:
        this.sendNotification(
          payload.passengerId,
          `Your driver ${payload.driverName} is arriving at your pickup location!`,
          'PUSH'
        );
        break;

      case EVENT_TYPES.RIDE_STARTED:
        this.sendNotification(
          payload.passengerId,
          `Your ride has started! Have a safe journey to your destination.`,
          'SMS'
        );
        break;

      case EVENT_TYPES.RIDE_COMPLETED:
        this.sendNotification(
          payload.passengerId,
          `You have arrived at your destination! Processing payment of $${payload.fare}...`,
          'PUSH'
        );
        break;

      case EVENT_TYPES.RIDE_CANCELLED:
        const cancelUser = payload.cancelledBy === 'PASSENGER' ? payload.driverId : payload.passengerId;
        if (cancelUser) {
          this.sendNotification(
            cancelUser,
            `The ride has been cancelled by the other party.`,
            'SMS'
          );
        }
        break;
    }
  }

  private handlePaymentEvents(envelope: EventEnvelope) {
    const { type, payload } = envelope;

    switch (type) {
      case EVENT_TYPES.PAYMENT_SUCCESS:
        this.sendNotification(
          payload.passengerId,
          `Payment of $${payload.amount} successful! Invoice ${payload.transactionId} sent to your email.`,
          'EMAIL'
        );
        this.sendNotification(
          payload.driverId,
          `Earnings of $${payload.driverEarnings} successfully credited to your wallet!`,
          'PUSH'
        );
        break;

      case EVENT_TYPES.PAYMENT_FAILED:
        this.sendNotification(
          payload.passengerId,
          `Payment of $${payload.amount} failed. Reason: ${payload.reason}. Please check your wallet.`,
          'PUSH'
        );
        break;
    }
  }

  /**
   * Send simulated notification
   */
  public sendNotification(userId: string, message: string, type: 'PUSH' | 'SMS' | 'EMAIL' | 'WHATSAPP') {
    const notification: Notification = {
      id: uuidv4(),
      userId,
      message,
      type,
      timestamp: new Date().toISOString(),
    };

    this.notifications.push(notification);

    // Publish notification-sent event
    EventBus.publish(
      KAFKA_TOPICS.NOTIFICATION,
      EVENT_TYPES.NOTIFICATION_SENT,
      notification,
      userId
    );

    // Keep memory cache trimmed
    if (this.notifications.length > 50) {
      this.notifications.shift();
    }
  }

  public getNotificationsForUser(userId: string): Notification[] {
    return this.notifications.filter((n) => n.userId === userId);
  }
}

export const NotificationServiceInstance = new NotificationService();
export default NotificationServiceInstance;
