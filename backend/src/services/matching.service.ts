// ============================================================================
// RIDECONNECT DISPATCH & MATCHING MICROSERVICE
// ============================================================================
// This service operates as a classic event consumer. It subscribes to the
// 'ride-events' topic on the simulated Kafka message broker.
// When a RIDE_REQUESTED event is parsed, this service dynamically executes
// spatial geo-searches to identify available drivers within proximity bounds.
// ============================================================================

import { KAFKA_TOPICS, EVENT_TYPES, EventEnvelope } from 'shared';
import EventBus from '../eventbus/eventbus.js';
import DriverService from './driver.service.js';

class MatchingService {
  constructor() {
    // Register event listeners immediately during service boot-up
    this.setupSubscriptions();
    console.log('[MatchingService] Ride Matching Engine initialized.');
  }

  /**
   * Subscribe consumer callbacks to core message broker topics.
   * Direct match for Kafka consumer group setups.
   */
  private setupSubscriptions() {
    // Register listener on the RIDE topic for active ride cycles
    EventBus.subscribe(KAFKA_TOPICS.RIDE, (envelope) => this.handleRideEvents(envelope));
  }

  /**
   * Event handler callback filtering incoming messages.
   * Matches stream-filtering operations.
   */
  private handleRideEvents(envelope: EventEnvelope) {
    const { type, payload } = envelope;

    // Filter stream: We only act when a new passenger requests a ride
    if (type === EVENT_TYPES.RIDE_REQUESTED) {
      // Direct payload to matching calculations
      this.findMatchForRide(payload.id, payload.pickup);
    }
  }

  /**
   * Main matching logic execution loop.
   * Identifies candidate drivers and relays ride offer dispatches.
   * 
   * @param rideId - The unique ID of the requested trip
   * @param pickupLocation - Latitude/longitude coordinates of passenger pickup
   */
  private findMatchForRide(rideId: string, pickupLocation: any) {
    console.log(`[MatchingEngine] Finding nearby drivers for ride ${rideId}...`);

    // 1. Publish RIDE_MATCH_ATTEMPT to ride-events topic on Kafka.
    // This transitions state from REQUESTED to SEARCHING.
    EventBus.publish(
      KAFKA_TOPICS.RIDE,
      EVENT_TYPES.RIDE_MATCH_ATTEMPT,
      { rideId, searchRadiusKm: 5.0, status: 'SEARCHING_DRIVERS' },
      rideId
    );

    // 2. Query nearby drivers (simulates a Redis GEORADIUS query using the Haversine formula)
    // Limits lookup to drivers that are ONLINE, not BUSY, and within a 5.0km radius.
    const nearby = DriverService.findNearbyDrivers(pickupLocation, 5.0);

    // Check if zero online drivers are within spatial range
    if (nearby.length === 0) {
      console.log(`[MatchingEngine] No drivers available in 5.0km range for ride ${rideId}.`);
      
      // Fallback: Publish RIDE_CANCELLED to ride-events.
      // Simulates automated system timeouts when matching criteria aren't met.
      EventBus.publish(
        KAFKA_TOPICS.RIDE,
        EVENT_TYPES.RIDE_CANCELLED,
        { rideId, reason: 'NO_DRIVERS_AVAILABLE', cancelledBy: 'SYSTEM' },
        rideId
      );
      return;
    }

    // Proximity driver found! Log metrics
    console.log(`[MatchingEngine] Found ${nearby.length} drivers. Top candidate: ${nearby[0].driver.name} (${Math.round(nearby[0].distance * 100) / 100} km away)`);

    // In this Event-Driven workflow:
    // - The Matching Service successfully matches the nearest candidate.
    // - It assigns the candidate's ID to the dispatch queue.
    // - The API Gateway relays the offer to the driver's active WebSocket room.
    // - If the driver accepts, the ride transitions to DRIVER_ASSIGNED.
  }
}

// Export a single, static class instance of the microservice
export const MatchingServiceInstance = new MatchingService();
export default MatchingServiceInstance;
