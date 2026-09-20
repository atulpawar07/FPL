import { PaymentProvider } from './types';
import { ManualMockPaymentProvider } from './mock';

class PaymentServiceManager {
  private activeProvider: PaymentProvider;

  constructor() {
    // Default provider for Phase 1: Manual/Mock Payment Provider
    this.activeProvider = new ManualMockPaymentProvider();
  }

  public getProvider(): PaymentProvider {
    return this.activeProvider;
  }

  public setProvider(provider: PaymentProvider) {
    this.activeProvider = provider;
  }
}

export const PaymentService = new PaymentServiceManager();
