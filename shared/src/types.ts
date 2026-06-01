export type UserRole = 'PASSENGER' | 'DRIVER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  walletBalance: number;
  rating: number;
  phone: string;
  savedAddresses: { label: string; address: string; lat: number; lng: number }[];
}

export type DriverStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

export interface Vehicle {
  make: string;
  model: string;
  color: string;
  plateNumber: string;
  type: 'SEDAN' | 'SUV' | 'LUXURY' | 'BIKE';
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: DriverStatus;
  rating: number;
  acceptanceRate: number;
  vehicle: Vehicle;
  location: Location;
  currentRideId?: string;
  walletBalance: number;
  earningsDaily: number;
  earningsWeekly: number;
}

export type RideStatus =
  | 'REQUESTED'
  | 'SEARCHING_DRIVER'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVING'
  | 'STARTED'
  | 'COMPLETED'
  | 'PAID'
  | 'CANCELLED';

export interface Ride {
  id: string;
  passengerId: string;
  passengerName?: string;
  passengerPhone?: string;
  passengerRating?: number;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverRating?: number;
  driverLocation?: Location;
  vehicle?: Vehicle;
  pickup: Location;
  destination: Location;
  status: RideStatus;
  fare: number;
  distance: number; // in kilometers
  duration: number; // in minutes
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'PUSH' | 'SMS' | 'EMAIL' | 'WHATSAPP';
  timestamp: string;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalRides: number;
  activePassengers: number;
  activeDrivers: number;
  matchingLatencyAvg: number;
  cancellationRate: number;
}
