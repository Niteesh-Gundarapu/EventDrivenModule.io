import { startGatewayServer } from './gateway/gateway.js';

// Pre-instantiate services to ensure they initialize and set up EventBus subscriptions
import { AuthServiceInstance } from './services/auth.service.js';
import { DriverServiceInstance } from './services/driver.service.js';
import { RideServiceInstance } from './services/ride.service.js';
import { MatchingServiceInstance } from './services/matching.service.js';
import { PricingServiceInstance } from './services/pricing.service.js';
import { PaymentServiceInstance } from './services/payment.service.js';
import { NotificationServiceInstance } from './services/notification.service.js';
import { AnalyticsServiceInstance } from './services/analytics.service.js';

console.log('====================================================');
console.log('    RIDECONNECT BACKEND SERVER CORE INITIALIZATION   ');
console.log('====================================================');

// Start the core API Gateway & Socket Server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
startGatewayServer(PORT);
