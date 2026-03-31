import crypto from 'crypto';

interface NOWPaymentsTransaction {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
  created_at: string;
  updated_at: string;
  purchase_id: string;
  outcome_amount?: number;
  outcome_currency?: string;
}

interface NOWPaymentsWebhook {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
  purchase_id: string;
  outcome_amount: number;
  outcome_currency: string;
  payment_extra_id?: string;
}

export class NOWPaymentsService {
  private apiKey: string;
  private ipnSecret: string;
  private baseUrl: string = 'https://api.nowpayments.io/v1';

  constructor() {
    this.apiKey = process.env.NOWPAYMENTS_API_KEY || '';
    this.ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || '';
    
    if (!this.apiKey) {
      console.warn('NOWPayments API key not configured');
    }
  }

  /**
   * Verify NOWPayments webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.ipnSecret) {
      console.warn('NOWPayments IPN secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha512', this.ipnSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Process NOWPayments webhook notification
   */
  async processWebhook(webhookData: NOWPaymentsWebhook): Promise<{
    success: boolean;
    orderId?: string;
    amount?: number;
    currency?: string;
    status?: string;
  }> {
    try {
      console.log('Processing NOWPayments webhook:', {
        paymentId: webhookData.payment_id,
        status: webhookData.payment_status,
        orderId: webhookData.order_id,
        amount: webhookData.outcome_amount,
        currency: webhookData.outcome_currency
      });

      // Extract user ID from order_id (format: "user_{userId}_{timestamp}")
      const orderIdParts = webhookData.order_id.split('_');
      if (orderIdParts.length < 2 || orderIdParts[0] !== 'user') {
        throw new Error('Invalid order ID format');
      }

      const userId = orderIdParts[1];
      const amount = webhookData.outcome_amount || webhookData.price_amount;
      const currency = webhookData.outcome_currency || webhookData.price_currency;

      return {
        success: true,
        orderId: userId,
        amount,
        currency,
        status: webhookData.payment_status
      };

    } catch (error) {
      console.error('Error processing NOWPayments webhook:', error);
      return {
        success: false
      };
    }
  }

  /**
   * Get available currencies from NOWPayments
   */
  async getAvailableCurrencies(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/currencies`, {
        headers: {
          'x-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`NOWPayments API error: ${response.status}`);
      }

      const data = await response.json();
      return data.currencies || [];

    } catch (error) {
      console.error('Error fetching NOWPayments currencies:', error);
      return [];
    }
  }

  /**
   * Get payment status from NOWPayments
   */
  async getPaymentStatus(paymentId: string): Promise<NOWPaymentsTransaction | null> {
    try {
      const response = await fetch(`${this.baseUrl}/payment/${paymentId}`, {
        headers: {
          'x-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`NOWPayments API error: ${response.status}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Error fetching payment status:', error);
      return null;
    }
  }

  /**
   * Create payment link for user
   */
  generatePaymentLink(userId: string, amount: number, currency: string = 'USD'): string {
    const orderId = `user_${userId}_${Date.now()}`;
    const baseLink = 'https://nowpayments.io/payment/';
    
    // Use the provided integration ID
    const params = new URLSearchParams({
      iid: '5853137966',
      source: 'integration',
      order_id: orderId,
      price_amount: amount.toString(),
      price_currency: currency,
      order_description: `Deposit to account ${userId}`
    });

    return `${baseLink}?${params.toString()}`;
  }

  /**
   * Validate payment amount and currency
   */
  validatePayment(amount: number, currency: string): {
    valid: boolean;
    error?: string;
  } {
    if (amount < 1) {
      return {
        valid: false,
        error: 'Minimum payment amount is $1'
      };
    }

    if (amount > 50000) {
      return {
        valid: false,
        error: 'Maximum payment amount is $50,000'
      };
    }

    const supportedCurrencies = ['USD', 'EUR', 'BTC', 'ETH', 'USDT', 'USDC'];
    if (!supportedCurrencies.includes(currency.toUpperCase())) {
      return {
        valid: false,
        error: 'Currency not supported'
      };
    }

    return { valid: true };
  }

  /**
   * Log payment event for monitoring
   */
  logPaymentEvent(event: string, data: any): void {
    console.log(`NOWPayments ${event}:`, {
      timestamp: new Date().toISOString(),
      event,
      data
    });
  }
}

export const nowPaymentsService = new NOWPaymentsService();
