import { PaymentProvider, CreateOrderInput, CreateOrderResult, VerifyPaymentInput, VerifyPaymentResult } from './types';

export class ManualMockPaymentProvider implements PaymentProvider {
  public name = 'MANUAL_MOCK';

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const timestamp = Date.now();
    const orderId = `order_mock_${timestamp}_${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      orderId,
      amountPaise: input.amountPaise,
      currency: input.currency,
      gateway: this.name,
      metadata: {
        registrationReference: input.registrationReference,
        instructions: 'Phase 1 Mock/Manual Payment. Click "Simulate Successful Payment" to complete verification.',
      },
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const paymentId = input.paymentId || `pay_mock_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const txRef = input.transactionReference || `TXN-MOCK-${Math.floor(100000 + Math.random() * 900000)}`;

    // In Phase 1, any payment verification triggered via the mock gateway is verified cleanly
    return {
      success: true,
      status: 'SUCCESSFUL',
      orderId: input.orderId,
      paymentId,
      transactionReference: txRef,
      rawResponse: {
        provider: this.name,
        verifiedAt: new Date().toISOString(),
        notes: input.notes || 'Phase 1 manual payment verification simulated',
      },
    };
  }
}
