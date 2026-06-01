import { KAFKA_TOPICS, EVENT_TYPES } from 'shared';
import EventBus from '../eventbus/eventbus.js';
import AuthService from './auth.service.js';

class PaymentService {
  constructor() {
    console.log('[PaymentService] Initialized. Subscribed to payment-events.');
  }

  /**
   * Process payment for a ride (simulates transactional database update + outbox pattern)
   */
  public processPayment(rideId: string, passengerId: string, driverId: string, amount: number): boolean {
    // 1. Publish PAYMENT_INITIATED to payment-events Kafka topic
    EventBus.publish(
      KAFKA_TOPICS.PAYMENT,
      EVENT_TYPES.PAYMENT_INITIATED,
      { rideId, passengerId, driverId, amount },
      rideId
    );

    // Fetch user and driver details
    const passenger = AuthService.getUser(passengerId);
    const driver = AuthService.getDriver(driverId);

    if (!passenger || !driver) {
      this.failPayment(rideId, passengerId, driverId, amount, 'User or Driver not found');
      return false;
    }

    // In a real system, we'd wrap this in a database transaction
    // Check if passenger has sufficient wallet balance (simulation)
    if (passenger.walletBalance < amount) {
      this.failPayment(rideId, passengerId, driverId, amount, 'Insufficient wallet balance');
      return false;
    }

    // Deduct passenger balance
    AuthService.updateUserWallet(passengerId, -amount);
    
    // Add driver balance (driver takes 80%, platform takes 20%)
    const driverEarnings = Math.round(amount * 0.8 * 100) / 100;
    AuthService.updateDriverWallet(driverId, driverEarnings);

    // Cache updated wallet status in simulated Redis (locks/sessions)
    EventBus.logRedisActivity('SET', `wallet:user:${passengerId}`, passenger.walletBalance);
    EventBus.logRedisActivity('SET', `wallet:driver:${driverId}`, driver.walletBalance);

    // 2. Publish PAYMENT_SUCCESS event
    EventBus.publish(
      KAFKA_TOPICS.PAYMENT,
      EVENT_TYPES.PAYMENT_SUCCESS,
      {
        rideId,
        passengerId,
        driverId,
        amount,
        driverEarnings,
        transactionId: `tx-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        timestamp: new Date().toISOString()
      },
      rideId
    );

    return true;
  }

  private failPayment(rideId: string, passengerId: string, driverId: string, amount: number, reason: string) {
    console.error(`[PaymentService] Payment failed for ride ${rideId}. Reason: ${reason}`);
    
    EventBus.publish(
      KAFKA_TOPICS.PAYMENT,
      EVENT_TYPES.PAYMENT_FAILED,
      { rideId, passengerId, driverId, amount, reason, timestamp: new Date().toISOString() },
      rideId
    );
  }
}

export const PaymentServiceInstance = new PaymentService();
export default PaymentServiceInstance;
