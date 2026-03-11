import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Only allow in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, message: 'Mock payment only available in development mode' },
      { status: 403 }
    );
  }

  try {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay

    return NextResponse.json({
      success: true,
      message: "Payment successful (mock)",
      transactionId: "MOCK-TRX-12345"
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Mock payment failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { success: false, message: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { success: false, message: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    { success: false, message: 'Method not allowed' },
    { status: 405 }
  );
}