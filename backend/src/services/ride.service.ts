import { Ride, RideStatus, Location, KAFKA_TOPICS, EVENT_TYPES, DriverStatus } from 'shared';
import { v4 as uuidv4 } from 'uuid';
import EventBus from '../eventbus/eventbus.js';
import AuthService from './auth.service.js';
import PricingService from './pricing.service.js';
import PaymentService from './payment.service.js';

class RideService {
  private activeRides: Map<string, Ride> = new Map();

  constructor() {
    console.log('[RideService] Initialized. Ready to handle ride lifecycles.');
  }

  /**
   * Request a new ride
   */
  public requestRide(passengerId: string, pickup: Location, destination: Location): Ride | undefined {
    const passenger = AuthService.getUser(passengerId);
    if (!passenger) return undefined;

    const distanceKm = this.calculateDistance(pickup, destination);
    // Assume average speed 30 km/h (0.5 km per min) -> duration is distance * 2 minutes
    const durationMin = Math.max(Math.round(distanceKm * 2), 2);

    // Get current searching driver requests count to factor in surge pricing
    const searchingCount = Array.from(this.activeRides.values()).filter(
      (r) => r.status === 'REQUESTED' || r.status === 'SEARCHING_DRIVER'
    ).length;

    // Estimate price
    const fareDetails = PricingService.estimateFare(pickup, destination, distanceKm, durationMin, searchingCount);

    const rideId = uuidv4();
    const ride: Ride = {
      id: rideId,
      passengerId,
      passengerName: passenger.name,
      passengerPhone: passenger.phone,
      passengerRating: passenger.rating,
      pickup,
      destination,
      status: 'REQUESTED',
      fare: fareDetails.finalFare,
      distance: Math.round(distanceKm * 100) / 100,
      duration: durationMin,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.activeRides.set(rideId, ride);

    // Cache ride details in simulated Redis: ride:{rideId}
    EventBus.logRedisActivity('SET', `ride:${rideId}`, ride);

    // Publish RIDE_REQUESTED to ride-events Kafka topic
    EventBus.publish(
      KAFKA_TOPICS.RIDE,
      EVENT_TYPES.RIDE_REQUESTED,
      ride,
      rideId
    );

    return ride;
  }

  /**
   * Assign driver to an active ride
   */
  public assignDriver(rideId: string, driverId: string): Ride | undefined {
    const ride = this.activeRides.get(rideId);
    const driver = AuthService.getDriver(driverId);

    if (!ride || !driver) return undefined;

    // Check distributed lock in Redis: ride:{rideId}:lock
    EventBus.logRedisActivity('SET', `ride:${rideId}:lock`, 'LOCKED');

    if (ride.status !== 'REQUESTED' && ride.status !== 'SEARCHING_DRIVER') {
      // Already assigned or cancelled
      EventBus.logRedisActivity('DEL', `ride:${rideId}:lock`, 'UNLOCKED');
      return undefined;
    }

    // Update ride details
    ride.status = 'DRIVER_ASSIGNED';
    ride.driverId = driverId;
    ride.driverName = driver.name;
    ride.driverPhone = driver.phone;
    ride.driverRating = driver.rating;
    ride.driverLocation = driver.location;
    ride.vehicle = driver.vehicle;
    ride.updatedAt = new Date().toISOString();

    // Lock driver to busy
    driver.status = 'BUSY';
    driver.currentRideId = rideId;

    // Save in Redis caches
    EventBus.logRedisActivity('SET', `ride:${rideId}`, ride);
    EventBus.logRedisActivity('SET', `driver:${driverId}`, driver);
    EventBus.logRedisActivity('DEL', `ride:${rideId}:lock`, 'UNLOCKED');

    // Publish RIDE_ASSIGNED event
    EventBus.publish(
      KAFKA_TOPICS.RIDE,
      EVENT_TYPES.RIDE_ASSIGNED,
      ride,
      rideId
    );

    return ride;
  }

  /**
   * Notify ride passenger that driver is arriving
   */
  public arriveAtPickup(rideId: string): Ride | undefined {
    const ride = this.activeRides.get(rideId);
    if (!ride) return undefined;

    ride.status = 'DRIVER_ARRIVING';
    ride.updatedAt = new Date().toISOString();

    EventBus.logRedisActivity('SET', `ride:${rideId}`, ride);

    // Publish RIDE_ARRIVING event
    EventBus.publish(
      KAFKA_TOPICS.RIDE,
      EVENT_TYPES.RIDE_ARRIVING,
      ride,
      rideId
    );

    return ride;
  }

  /**
   * Start the ride (passenger has entered the vehicle)
   */
  public startRide(rideId: string): Ride | undefined {
    const ride = this.activeRides.get(rideId);
    if (!ride) return undefined;

    ride.status = 'STARTED';
    ride.updatedAt = new Date().toISOString();

    EventBus.logRedisActivity('SET', `ride:${rideId}`, ride);

    // Publish RIDE_STARTED event
    EventBus.publish(
      KAFKA_TOPICS.RIDE,
      EVENT_TYPES.RIDE_STARTED,
      ride,
      rideId
    );

    return ride;
  }

  /**
   * Complete the ride (reached destination)
   */
  public completeRide(rideId: string): Ride | undefined {
    const ride = this.activeRides.get(rideId);
    if (!ride) return undefined;

    ride.status = 'COMPLETED';
    ride.updatedAt = new Date().toISOString();

    EventBus.logRedisActivity('SET', `ride:${rideId}`, ride);

    // Publish RIDE_COMPLETED event
    EventBus.publish(
      KAFKA_TOPICS.RIDE,
      EVENT_TYPES.RIDE_COMPLETED,
      ride,
      rideId
    );

    // Trigger Payment System asynchronously via Saga / Outbox
    if (ride.driverId) {
      const paymentSuccess = PaymentService.processPayment(
        rideId,
        ride.passengerId,
        ride.driverId,
        ride.fare
      );

      if (paymentSuccess) {
        ride.status = 'PAID';
        EventBus.logRedisActivity('SET', `ride:${rideId}`, ride);
      }
      
      // Release driver back to online status
      const driver = AuthService.getDriver(ride.driverId);
      if (driver) {
        driver.status = 'ONLINE';
        driver.currentRideId = undefined;
        EventBus.logRedisActivity('SET', `driver:${ride.driverId}`, driver);
      }
    }

    // Move completed ride out of active registry into history after a short period (keep active for sockets momentarily)
    setTimeout(() => {
      this.activeRides.delete(rideId);
    }, 15000);

    return ride;
  }

  /**
   * Cancel an active ride
   */
  public cancelRide(rideId: string, cancelledBy: 'PASSENGER' | 'DRIVER' | 'SYSTEM'): Ride | undefined {
    const ride = this.activeRides.get(rideId);
    if (!ride) return undefined;

    ride.status = 'CANCELLED';
    ride.updatedAt = new Date().toISOString();

    EventBus.logRedisActivity('SET', `ride:${rideId}`, ride);

    // Release driver if assigned
    if (ride.driverId) {
      const driver = AuthService.getDriver(ride.driverId);
      if (driver) {
        driver.status = 'ONLINE';
        driver.currentRideId = undefined;
        EventBus.logRedisActivity('SET', `driver:${ride.driverId}`, driver);
      }
    }

    // Publish RIDE_CANCELLED event
    EventBus.publish(
      KAFKA_TOPICS.RIDE,
      EVENT_TYPES.RIDE_CANCELLED,
      { rideId, passengerId: ride.passengerId, driverId: ride.driverId, cancelledBy },
      rideId
    );

    setTimeout(() => {
      this.activeRides.delete(rideId);
    }, 10000);

    return ride;
  }

  public getRide(rideId: string): Ride | undefined {
    return this.activeRides.get(rideId);
  }

  public getActiveRides(): Ride[] {
    return Array.from(this.activeRides.values());
  }

  /**
   * Helper: Haversine distance
   */
  private calculateDistance(loc1: Location, loc2: Location): number {
    const R = 6371;
    const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
    const dLon = (loc2.lng - loc1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.lat * (Math.PI / 180)) *
        Math.cos(loc2.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const RideServiceInstance = new RideService();
export default RideServiceInstance;
