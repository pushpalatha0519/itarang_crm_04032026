import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const { leadId, amount, currency = 'INR' } = await request.json();

    if (!leadId || !amount) {
      return NextResponse.json(
        { success: false, message: 'Lead ID and amount are required' },
        { status: 400 }
      );
    }

    // Check if Razorpay keys are configured
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret || keyId.includes('your_key') || keySecret.includes('your_secret')) {
      return NextResponse.json(
        { success: false, message: 'Razorpay keys not configured. Please add valid keys to .env.local' },
        { status: 500 }
      );
    }

    // Create Razorpay order
    const options = {
      amount: amount * 100, // Razorpay expects amount in paisa
      currency,
      receipt: `lead_${leadId}_${Date.now()}`,
      payment_capture: 1, // Auto capture
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
    });
  } catch (error: unknown) {
    console.error('Razorpay order creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `Payment order creation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}