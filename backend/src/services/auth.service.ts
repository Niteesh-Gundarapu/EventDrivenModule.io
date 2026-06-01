import { User, Driver } from 'shared';

class AuthService {
  private users: Map<string, User> = new Map();
  private drivers: Map<string, Driver> = new Map();

  constructor() {
    this.seedMockData();
  }

  private seedMockData() {
    // Seed Passengers
    const passenger1: User = {
      id: 'passenger-1',
      name: 'Alice Cooper',
      email: 'alice@rideconnect.io',
      role: 'PASSENGER',
      walletBalance: 120.50,
      rating: 4.8,
      phone: '+1 (555) 123-4567',
      savedAddresses: [
        { label: 'Home', address: 'Upper East Side, New York, NY', lat: 40.7736, lng: -73.9566 },
        { label: 'Work', address: 'Times Square, New York, NY', lat: 40.7580, lng: -73.9855 }
      ]
    };

    const passenger2: User = {
      id: 'passenger-2',
      name: 'Bob Martin',
      email: 'bob@rideconnect.io',
      role: 'PASSENGER',
      walletBalance: 45.00,
      rating: 4.5,
      phone: '+1 (555) 987-6543',
      savedAddresses: [
        { label: 'Home', address: 'Upper West Side, New York, NY', lat: 40.7870, lng: -73.9754 },
        { label: 'Gym', address: 'Central Park West, New York, NY', lat: 40.7713, lng: -73.9741 }
      ]
    };

    this.users.set(passenger1.id, passenger1);
    this.users.set(passenger2.id, passenger2);

    // Seed Drivers (positioned around Central Park, NY)
    const driver1: Driver = {
      id: 'driver-1',
      name: 'Sarah Connor',
      email: 'sarah.c@rideconnect.io',
      phone: '+1 (555) 234-5678',
      status: 'OFFLINE',
      rating: 4.9,
      acceptanceRate: 0.98,
      vehicle: {
        make: 'Toyota',
        model: 'Camry',
        color: 'Midnight Black',
        plateNumber: 'T-800-NY',
        type: 'SEDAN'
      },
      location: { lat: 40.7712, lng: -73.9671 }, // Upper East Side
      walletBalance: 320.00,
      earningsDaily: 0,
      earningsWeekly: 0
    };

    const driver2: Driver = {
      id: 'driver-2',
      name: 'John Wick',
      email: 'john.w@rideconnect.io',
      phone: '+1 (555) 345-6789',
      status: 'OFFLINE',
      rating: 5.0,
      acceptanceRate: 1.00,
      vehicle: {
        make: 'Ford',
        model: 'Mustang GT',
        color: 'Gunmetal Grey',
        plateNumber: 'BABA-YAGA',
        type: 'LUXURY'
      },
      location: { lat: 40.7903, lng: -73.9580 }, // Upper West Side
      walletBalance: 1540.00,
      earningsDaily: 0,
      earningsWeekly: 0
    };

    const driver3: Driver = {
      id: 'driver-3',
      name: 'James Bond',
      email: 'james.b@rideconnect.io',
      phone: '+1 (555) 007-0007',
      status: 'OFFLINE',
      rating: 4.7,
      acceptanceRate: 0.85,
      vehicle: {
        make: 'Aston Martin',
        model: 'DB11',
        color: 'Liquid Silver',
        plateNumber: 'JB-007-NY',
        type: 'LUXURY'
      },
      location: { lat: 40.7580, lng: -73.9855 }, // Times Square
      walletBalance: 2450.00,
      earningsDaily: 0,
      earningsWeekly: 0
    };

    const driver4: Driver = {
      id: 'driver-4',
      name: 'Ellen Ripley',
      email: 'ripley@rideconnect.io',
      phone: '+1 (555) 456-7890',
      status: 'OFFLINE',
      rating: 4.8,
      acceptanceRate: 0.92,
      vehicle: {
        make: 'Jeep',
        model: 'Wrangler Rubicon',
        color: 'Rescue Yellow',
        plateNumber: 'SULAKO-1',
        type: 'SUV'
      },
      location: { lat: 40.8010, lng: -73.9680 }, // Morningside Heights
      walletBalance: 110.00,
      earningsDaily: 0,
      earningsWeekly: 0
    };

    this.drivers.set(driver1.id, driver1);
    this.drivers.set(driver2.id, driver2);
    this.drivers.set(driver3.id, driver3);
    this.drivers.set(driver4.id, driver4);
  }

  public getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  public getDriver(id: string): Driver | undefined {
    return this.drivers.get(id);
  }

  public getUsers(): User[] {
    return Array.from(this.users.values());
  }

  public getDrivers(): Driver[] {
    return Array.from(this.drivers.values());
  }

  public updateUserWallet(userId: string, amount: number): boolean {
    const user = this.users.get(userId);
    if (user) {
      user.walletBalance += amount;
      return true;
    }
    return false;
  }

  public updateDriverWallet(driverId: string, amount: number): boolean {
    const driver = this.drivers.get(driverId);
    if (driver) {
      driver.walletBalance += amount;
      driver.earningsDaily += amount;
      driver.earningsWeekly += amount;
      return true;
    }
    return false;
  }
}

export const AuthServiceInstance = new AuthService();
export default AuthServiceInstance;
