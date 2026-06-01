// ============================================================================
// RIDECONNECT EVENT BROKER / MESSAGE BUS ENGINE
// ============================================================================
// This file implements a decoupled, high-performance in-memory Message Broker.
// It serves as a simulated Confluent Kafka cluster and Redis cache engine.
// All modular microservices subscribe to topics on this bus to implement
// pure Event-Driven Architecture (EDA) flows.
// ============================================================================

import { v4 as uuidv4 } from 'uuid'; // For generating globally unique event payload IDs
import { EventEnvelope } from 'shared'; // Shared strict event structures/schemas

// Define a type for our topic consumers (subscribed callback listeners)
type EventListener = (envelope: EventEnvelope) => void;

class EventBusService {
  // Mapping table of Kafka topics -> Set of active subscribed consumer callback listeners
  private listeners: Map<string, Set<EventListener>> = new Map();
  
  // Real-time telemetry log listeners (e.g. API Gateway sockets broadcasting to system dashboard)
  private systemLogListeners: Set<(log: any) => void> = new Set();

  constructor() {
    console.log('[EventBus] Simulated Kafka / Redis Event Broker initialized.');
  }

  /**
   * Publish an event to a Kafka-like topic.
   * This simulates producer behavior, constructing envelopes and notifying consumers.
   * 
   * @param topic - The Kafka topic destination (e.g., 'ride-events')
   * @param type - The event state type (e.g., 'RIDE_REQUESTED')
   * @param payload - The structural object data representing the event details
   * @param partitionKey - Key used to guarantee strict event ordering (e.g., rideId)
   */
  public publish<T = any>(
    topic: string,
    type: string,
    payload: T,
    partitionKey?: string
  ): EventEnvelope<T> {
    // Construct a standard structured Kafka Message Envelope
    const envelope: EventEnvelope<T> = {
      id: uuidv4(),                        // UUID v4 guarantees event message uniqueness
      topic,                               // Destination topic
      type,                                // Event sub-state identifier
      payload,                             // Unwrapped operational content
      timestamp: new Date().toISOString(), // Standard ISO precision time stamp
      partitionKey,                        // Optional ordering target key
    };

    // Print standard container operational log
    console.log(`[EventBus: ${topic}] ${type} published. PartitionKey: ${partitionKey || 'none'}`);

    // Fetch and trigger all consumers subscribed to this specific Kafka topic
    const topicListeners = this.listeners.get(topic);
    if (topicListeners) {
      topicListeners.forEach((listener) => {
        try {
          // Asynchronously trigger consumer callback (isolated in try-catch to prevent crash loops)
          listener(envelope);
        } catch (err) {
          console.error(`[EventBus] Error in consumer for topic ${topic}:`, err);
        }
      });
    }

    // Wrap the event in an Observability telemetry envelope and publish to the gateway socket room
    const logItem = {
      id: envelope.id,
      category: 'KAFKA',              // Identifies it as a message-bus broker transaction
      source: 'MessageBroker',
      action: 'PUBLISH',
      target: topic,
      detail: `${type}`,
      payload: envelope,
      timestamp: envelope.timestamp,
    };
    
    // Broadcast message detail to all system monitoring consoles in real-time
    this.systemLogListeners.forEach((listener) => listener(logItem));

    return envelope;
  }

  /**
   * Subscribe a microservice consumer to a Kafka topic.
   * Simulates a consumer group subscribing to a cluster topic partition.
   * 
   * @param topic - Topic name to monitor
   * @param listener - Consumer callback trigger
   * @returns Unsubscribe clean-up trigger function
   */
  public subscribe(topic: string, listener: EventListener): () => void {
    // If topic key is not initialized in our mapping table, create a new Set
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    
    // Bind consumer to this topic listener
    this.listeners.get(topic)!.add(listener);

    // Return a self-contained unsubscribe clean-up function
    return () => {
      const topicListeners = this.listeners.get(topic);
      if (topicListeners) {
        topicListeners.delete(listener);
      }
    };
  }

  /**
   * Log a simulated Redis cache read, write, or expire activity.
   * Enables the frontend control center to display active Redis key updates.
   * 
   * @param action - Redis command (SET, GET, DEL, etc.)
   * @param key - Cache key identifier (e.g. 'driver:location:driver-1')
   * @param value - The cached data payload
   */
  public logRedisActivity(action: 'SET' | 'GET' | 'DEL' | 'EXPIRE', key: string, value: any) {
    const logItem = {
      id: uuidv4(),
      category: 'REDIS',            // Identifies transaction as a Redis Cache action
      source: 'CacheService',
      action,
      target: key,
      detail: `${action} key: ${key}`,
      payload: value,
      timestamp: new Date().toISOString(),
    };
    
    // Relay logs to the API socket monitor for real-time visualization
    this.systemLogListeners.forEach((listener) => listener(logItem));
  }

  /**
   * Register a listener for system logs (called by Gateway WebSocket to sync the front-end stream)
   */
  public registerSystemLogListener(listener: (log: any) => void): () => void {
    this.systemLogListeners.add(listener);
    return () => {
      this.systemLogListeners.delete(listener);
    };
  }
}

// Export a single, unified static instance of the Message Broker
export const EventBus = new EventBusService();
export default EventBus;
