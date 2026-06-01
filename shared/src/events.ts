export const KAFKA_TOPICS = {
  USER: 'user-events',
  DRIVER: 'driver-events',
  RIDE: 'ride-events',
  PAYMENT: 'payment-events',
  NOTIFICATION: 'notification-events',
  ANALYTICS: 'analytics-events',
} as const;

export const EVENT_TYPES = {
  // User events
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGGED_IN: 'USER_LOGGED_IN',

  // Driver events
  DRIVER_ONLINE: 'DRIVER_ONLINE',
  DRIVER_OFFLINE: 'DRIVER_OFFLINE',
  DRIVER_LOCATION_UPDATED: 'DRIVER_LOCATION_UPDATED',

  // Ride events
  RIDE_REQUESTED: 'RIDE_REQUESTED',
  RIDE_MATCH_ATTEMPT: 'RIDE_MATCH_ATTEMPT',
  RIDE_ASSIGNED: 'RIDE_ASSIGNED',
  RIDE_ARRIVING: 'RIDE_ARRIVING',
  RIDE_STARTED: 'RIDE_STARTED',
  RIDE_COMPLETED: 'RIDE_COMPLETED',
  RIDE_CANCELLED: 'RIDE_CANCELLED',

  // Payment events
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // Notification events
  NOTIFICATION_SENT: 'NOTIFICATION_SENT',
} as const;

export interface EventEnvelope<T = any> {
  id: string;
  topic: string;
  type: string;
  payload: T;
  timestamp: string;
  partitionKey?: string; // e.g., rideId, driverId, userId for ordering
}

// Websocket real-time channels / channels used for Redis PubSub
export const WEBSOCKET_CHANNELS = {
  USER: (userId: string) => `user:${userId}`,
  DRIVER: (driverId: string) => `driver:${driverId}`,
  RIDE: (rideId: string) => `ride:${rideId}`,
  SYSTEM: 'system:events',
} as const;
