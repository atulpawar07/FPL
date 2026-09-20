import { describe, it, expect } from 'vitest';
import { PaymentService } from '@/lib/payment/service';
import { ManualMockPaymentProvider } from '@/lib/payment/mock';

describe('Modular Payment Service Unit Tests', () => {
  it('should create payment order with integer paise amount using default provider', async () => {
    const provider = PaymentService.getProvider();
    expect(provider.name).toBe('MANUAL_MOCK');

    const order = await provider.createOrder({
      registrationId: 'test-reg-id-123',
      registrationReference: 'REG-2026-99999',
      amountPaise: 50000,
      currency: 'INR',
    });

    expect(order.orderId).toContain('order_mock_');
    expect(order.amountPaise).toBe(50000);
    expect(order.currency).toBe('INR');
  });

  it('should verify payment successfully using ManualMockPaymentProvider', async () => {
    const provider = PaymentService.getProvider();
    const result = await provider.verifyPayment({
      orderId: 'order_mock_12345',
      transactionReference: 'TXN-MOCK-777',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('SUCCESSFUL');
    expect(result.transactionReference).toBe('TXN-MOCK-777');
  });

  it('should allow plugging in a custom payment provider without breaking PaymentService interface', () => {
    class TestCustomProvider {
      public name = 'TEST_CUSTOM';
      async createOrder() {
        return { orderId: 'custom_123', amountPaise: 50000, currency: 'INR', gateway: 'TEST_CUSTOM' };
      }
      async verifyPayment() {
        return { success: true, status: 'SUCCESSFUL' as const, orderId: 'custom_123', paymentId: 'p_123', transactionReference: 'tx_123', rawResponse: {} };
      }
    }

    PaymentService.setProvider(new TestCustomProvider() as any);
    expect(PaymentService.getProvider().name).toBe('TEST_CUSTOM');

    // Reset back to mock provider
    PaymentService.setProvider(new ManualMockPaymentProvider());
    expect(PaymentService.getProvider().name).toBe('MANUAL_MOCK');
  });
});
