import { Request, Response, RequestHandler } from 'express';
import { nowPaymentsService } from '../services/NOWPaymentsService';
import { getUserById, updateUserBalance } from '../data/users';

/**
 * NOWPayments webhook endpoint
 * Handles payment status notifications from NOWPayments
 */
export const handleNOWPaymentsWebhook: RequestHandler = async (req, res) => {
  try {
    const signature = req.headers['x-nowpayments-sig'] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!nowPaymentsService.verifyWebhookSignature(payload, signature)) {
      console.warn('Invalid NOWPayments webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhookData = req.body;
    const result = await nowPaymentsService.processWebhook(webhookData);

    if (!result.success) {
      return res.status(400).json({ error: 'Failed to process webhook' });
    }

    // Update user balance if payment is successful
    if (result.status === 'finished' && result.orderId && result.amount) {
      const user = getUserById(result.orderId);

      if (user) {
        const usdAmount = result.currency === 'USD' ? result.amount : result.amount; // Convert if needed
        const newBalance = user.balance + usdAmount;
        const updatedUser = updateUserBalance(user.id, newBalance);

        if (updatedUser) {
          console.log(`NOWPayments: Updated balance for user ${user.id}: +$${usdAmount} (Total: $${newBalance})`);

          // Log successful payment
          nowPaymentsService.logPaymentEvent('payment_completed', {
            userId: user.id,
            paymentId: webhookData.payment_id,
            amount: usdAmount,
            currency: result.currency,
            newBalance: newBalance
          });
        } else {
          console.error(`NOWPayments: Failed to update balance for user ${user.id}`);
        }
      } else {
        console.warn(`NOWPayments: User not found for order ID: ${result.orderId}`);
      }
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('NOWPayments webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get NOWPayments status
 * Returns service availability and configuration status
 */
export const getNOWPaymentsStatus: RequestHandler = async (req, res) => {
  try {
    const currencies = await nowPaymentsService.getAvailableCurrencies();
    
    res.json({
      success: true,
      data: {
        available: currencies.length > 0,
        supportedCurrencies: currencies.slice(0, 20), // Return first 20 currencies
        integration: {
          id: '5853137966',
          type: 'button',
          url: 'https://nowpayments.io/payment/?iid=5853137966'
        }
      }
    });

  } catch (error) {
    console.error('Error getting NOWPayments status:', error);
    res.status(500).json({ error: 'Failed to get service status' });
  }
};

/**
 * Create payment link for user
 * Generates a personalized payment link for the authenticated user
 */
export const createPaymentLink: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { amount, currency = 'USD' } = req.body;

    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Validate payment
    const validation = nowPaymentsService.validatePayment(amount, currency);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Generate payment link
    const paymentLink = nowPaymentsService.generatePaymentLink(userId, amount, currency);

    // Log payment initiation
    nowPaymentsService.logPaymentEvent('payment_initiated', {
      userId,
      amount,
      currency,
      paymentLink
    });

    res.json({
      success: true,
      data: {
        paymentLink,
        amount,
        currency,
        orderId: `user_${userId}_${Date.now()}`
      }
    });

  } catch (error) {
    console.error('Error creating payment link:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
};

/**
 * Get payment status
 * Check the status of a specific payment
 */
export const getPaymentStatus: RequestHandler = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }

    const paymentData = await nowPaymentsService.getPaymentStatus(paymentId);

    if (!paymentData) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify payment belongs to user
    const orderIdParts = paymentData.order_id.split('_');
    if (orderIdParts.length < 2 || orderIdParts[1] !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      data: {
        paymentId: paymentData.payment_id,
        status: paymentData.payment_status,
        amount: paymentData.price_amount,
        currency: paymentData.price_currency,
        payAmount: paymentData.pay_amount,
        payCurrency: paymentData.pay_currency,
        payAddress: paymentData.pay_address,
        createdAt: paymentData.created_at,
        updatedAt: paymentData.updated_at
      }
    });

  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};
