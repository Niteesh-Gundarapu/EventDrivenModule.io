import { Location } from 'shared';

class PricingService {
  private baseFare = 2.50; // $
  private perKmRate = 1.50; // $ per km
  private perMinuteRate = 0.40; // $ per min

  /**
   * Calculate fare estimation based on pickup and destination
   */
  public estimateFare(
    pickup: Location,
    destination: Location,
    distanceKm: number,
    durationMin: number,
    activeRequestsCount: number
  ) {
    const distanceFare = distanceKm * this.perKmRate;
    const timeFare = durationMin * this.perMinuteRate;

    // Simulate Dynamic Surge Multiplier (higher demand increases surge)
    let surgeMultiplier = 1.0;
    if (activeRequestsCount >= 4) {
      surgeMultiplier = 2.0;
    } else if (activeRequestsCount >= 2) {
      surgeMultiplier = 1.4;
    } else if (activeRequestsCount >= 1) {
      surgeMultiplier = 1.1;
    }

    const subTotal = this.baseFare + distanceFare + timeFare;
    const surgedTotal = subTotal * surgeMultiplier;
    
    // Taxes & Fees (10%)
    const taxes = surgedTotal * 0.10;
    const finalFare = Math.round((surgedTotal + taxes) * 100) / 100;

    return {
      baseFare: this.baseFare,
      distanceFare: Math.round(distanceFare * 100) / 100,
      timeFare: Math.round(timeFare * 100) / 100,
      surgeMultiplier,
      taxes: Math.round(taxes * 100) / 100,
      finalFare
    };
  }
}

export const PricingServiceInstance = new PricingService();
export default PricingServiceInstance;
