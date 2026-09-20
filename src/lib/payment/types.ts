import { PaymentStatus } from '@/types';

export interface CreateOrderInput {
  registrationId: string;
  registrationReference: string;
  amountPaise: number;
  currency: string;
}

export interface CreateOrderResult {
  orderId: string;
  amountPaise: number;
  currency: string;
  gateway: string;
  metadata?: Record<string, any>;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId?: string;
  signature?: string;
  transactionReference?: string;
  notes?: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  status: PaymentStatus;
  orderId: string;
  paymentId: string;
  transactionReference: string;
  rawResponse: any;
}

export interface PaymentProvider {
  name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}
