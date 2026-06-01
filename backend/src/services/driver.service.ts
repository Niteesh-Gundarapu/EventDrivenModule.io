import { Driver, DriverStatus, Location, KAFKA_TOPICS, EVENT_TYPES } from 'shared';
import EventBus from '../eventbus/eventbus.js';
import AuthService from './auth.service.js';

class DriverService {
  constructor() {
    console.log('[DriverService] Initialized. Subscribed to driver-events.');
  }

  /**
   * Set driver online status (simulates Redis key-value write)
   */
  public updateStatus(driverId: string, status: DriverStatus): Driver | undefined {
    const driver = AuthService.getDriver(driverId);
    if (!driver) return undefined;

    driver.status = status;
    if (status === 'OFFLINE') {
      driver.currentRideId = undefined;
    }

    // Cache updated status in simulated Redis: driver:{driverId}
    EventBus.logRedisActivity('SET', `driver:${driverId}`, { status, location: driver.location });

    // Publish event to Kafka topic: driver-events
    EventBus.publish(
      KAFKA_TOPICS.DRIVER,
      status === 'ONLINE' ? EVENT_TYPES.DRIVER_ONLINE : EVENT_TYPES.DRIVER_OFFLINE,
      { driverId, name: driver.name, vehicle: driver.vehicle, location: driver.location },
      driverId
    );

    return driver;
  }

  /**
   * Update driver location (simulates Redis Geospatial GEOADD driver:location)
   */
  public updateLocation(driverId: string, location: Location): Driver | undefined {
    const driver = AuthService.getDriver(driverId);
    if (!driver) return undefined;

    driver.location = location;

    // Cache updated location in simulated Redis: driver:location
    EventBus.logRedisActivity('SET', `driver:location:${driverId}`, location);

    // Publish location update event to Kafka topic: driver-events
    EventBus.publish(
      KAFKA_TOPICS.DRIVER,
      EVENT_TYPES.DRIVER_LOCATION_UPDATED,
      { driverId, name: driver.name, location, status: driver.status },
      driverId
    );

    return driver;
  }

  /**
   * Fetch nearby drivers using Haversine formula (simulates Redis GEORADIUS driver:location)
   */
  public findNearbyDrivers(center: Location, radiusKm: number): { driver: Driver; distance: number }[] {
    const drivers = AuthService.getDrivers();
    const matches: { driver: Driver; distance: number }[] = [];

    // Log Redis Read (simulated GEORADIUS)
    EventBus.logRedisActivity('GET', 'driver:location', { center, radiusKm });

    drivers.forEach((driver) => {
      if (driver.status === 'ONLINE' && !driver.currentRideId) {
        const dist = this.calculateDistance(center, driver.location);
        if (dist <= radiusKm) {
          matches.push({ driver, distance: dist });
        }
      }
    });

    // Sort by distance ascending
    return matches.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Helper: Haversine distance formula
   */
  private calculateDistance(loc1: Location, loc2: Location): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(loc2.lat - loc1.lat);
    const dLon = this.deg2rad(loc2.lng - loc1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(loc1.lat)) *
        Math.cos(this.deg2rad(loc2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const DriverServiceInstance = new DriverService();
export default DriverServiceInstance;
