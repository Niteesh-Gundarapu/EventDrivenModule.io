import { KAFKA_TOPICS, EVENT_TYPES, EventEnvelope } from 'shared';
import EventBus from '../eventbus/eventbus.js';
import AuthService from './auth.service.js';

interface FraudAlert {
  id: string;
  type: string;
  entityId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  timestamp: string;
}

class AnalyticsService {
  private metrics = {
    totalRevenue: 0,
    totalRides: 0,
    activePassengers: 2,
    activeDrivers: 0,
    matchingLatencyAvg: 1.4, // default 1.4s
    cancellationRate: 0,
    rideCountsByStatus: {
      COMPLETED: 0,
      CANCELLED: 0
    }
  };

  private fraudAlerts: FraudAlert[] = [];
  private rideRequestTimes: Map<string, number> = new Map();
  private driverCancelCounts: Map<string, number> = new Map();

  constructor() {
    this.setupSubscriptions();
    console.log('[AnalyticsService] Analytics & Fraud Engine initialized.');
  }

  private setupSubscriptions() {
    // Listen to ride-events
    EventBus.subscribe(KAFKA_TOPICS.RIDE, (envelope) => this.handleRideEvents(envelope));
    // Listen to payment-events
    EventBus.subscribe(KAFKA_TOPICS.PAYMENT, (envelope) => this.handlePaymentEvents(envelope));
    // Listen to driver-events
    EventBus.subscribe(KAFKA_TOPICS.DRIVER, (envelope) => this.handleDriverEvents(envelope));
  }

  private handleRideEvents(envelope: EventEnvelope) {
    const { type, payload } = envelope;

    switch (type) {
      case EVENT_TYPES.RIDE_REQUESTED:
        this.rideRequestTimes.set(payload.id, Date.now());
        break;

      case EVENT_TYPES.RIDE_ASSIGNED:
        // Calculate matching latency
        const requestTime = this.rideRequestTimes.get(payload.id);
        if (requestTime) {
          const latencySec = (Date.now() - requestTime) / 1000;
          this.metrics.matchingLatencyAvg = 
            (this.metrics.matchingLatencyAvg * this.metrics.totalRides + latencySec) / 
            (this.metrics.totalRides + 1);
        }
        break;

      case EVENT_TYPES.RIDE_COMPLETED:
        this.metrics.totalRides++;
        this.metrics.rideCountsByStatus.COMPLETED++;
        this.updateCancellationRate();
        break;

      case EVENT_TYPES.RIDE_CANCELLED:
        this.metrics.rideCountsByStatus.CANCELLED++;
        this.updateCancellationRate();

        // Fraud check: Repeated cancellations by a single entity
        if (payload.cancelledBy === 'DRIVER' && payload.driverId) {
          const count = (this.driverCancelCounts.get(payload.driverId) || 0) + 1;
          this.driverCancelCounts.set(payload.driverId, count);

          if (count >= 3) {
            this.triggerFraudAlert(
              'REPEATED_CANCELLATION',
              payload.driverId,
              'HIGH',
              `Driver cancelled ${count} rides within a short period. Potential service gaming.`
            );
          }
        }
        break;
    }
  }

  private handlePaymentEvents(envelope: EventEnvelope) {
    const { type, payload } = envelope;

    if (type === EVENT_TYPES.PAYMENT_SUCCESS) {
      this.metrics.totalRevenue += payload.amount;
      
      // Fraud check: Extremely high transaction size
      if (payload.amount > 200) {
        this.triggerFraudAlert(
          'SUSPICIOUS_PAYMENT',
          payload.passengerId,
          'MEDIUM',
          `Suspicious high transaction value of $${payload.amount} processed.`
        );
      }
    }
  }

  private handleDriverEvents(envelope: EventEnvelope) {
    const { type, payload } = envelope;

    if (type === EVENT_TYPES.DRIVER_ONLINE) {
      this.updateActiveDrivers();
    } else if (type === EVENT_TYPES.DRIVER_OFFLINE) {
      this.updateActiveDrivers();
    } else if (type === EVENT_TYPES.DRIVER_LOCATION_UPDATED) {
      // Fraud check: GPS Spoof Detection
      // If driver updates location and the distance from previous location implies an impossible speed
      const driver = AuthService.getDriver(payload.driverId);
      if (driver && driver.location) {
        const lastLoc = driver.location;
        const newLoc = payload.location;
        
        // Simple mock delta check: if coordinates jump by massive amounts instantly
        const deltaLat = Math.abs(newLoc.lat - lastLoc.lat);
        const deltaLng = Math.abs(newLoc.lng - lastLoc.lng);
        
        if (deltaLat > 0.1 || deltaLng > 0.1) {
          this.triggerFraudAlert(
            'GPS_SPOOF_DETECTION',
            payload.driverId,
            'HIGH',
            `Driver GPS coordinates jumped by over 10km instantly. GPS spoofing suspected.`
          );
        }
      }
    }
  }

  private updateActiveDrivers() {
    this.metrics.activeDrivers = AuthService.getDrivers().filter(d => d.status === 'ONLINE' || d.status === 'BUSY').length;
  }

  private updateCancellationRate() {
    const total = this.metrics.rideCountsByStatus.COMPLETED + this.metrics.rideCountsByStatus.CANCELLED;
    if (total > 0) {
      this.metrics.cancellationRate = this.metrics.rideCountsByStatus.CANCELLED / total;
    }
  }

  private triggerFraudAlert(type: string, entityId: string, severity: 'LOW' | 'MEDIUM' | 'HIGH', description: string) {
    const alert: FraudAlert = {
      id: `fraud-${Math.random().toString(36).substring(2, 8)}`,
      type,
      entityId,
      severity,
      description,
      timestamp: new Date().toISOString()
    };
    
    this.fraudAlerts.push(alert);
    console.warn(`[FRAUD ALERT] [${severity}] ${type} - ${description}`);

    // Publish to analytics topic on Kafka
    EventBus.publish(
      KAFKA_TOPICS.ANALYTICS,
      'FRAUD_ALERT_DETECTED',
      alert,
      entityId
    );
  }

  public getMetricsSummary() {
    this.updateActiveDrivers();
    return {
      ...this.metrics,
      totalRevenue: Math.round(this.metrics.totalRevenue * 100) / 100,
      cancellationRate: Math.round(this.metrics.cancellationRate * 100)
    };
  }

  public getFraudAlerts(): FraudAlert[] {
    return this.fraudAlerts;
  }
}

export const AnalyticsServiceInstance = new AnalyticsService();
export default AnalyticsServiceInstance;
