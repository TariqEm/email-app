import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ count: 0 });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      return NextResponse.json({ count: 0 });
    }

    // Count invalid clicks (exclude fraud)
    // Invalid = wrong country but not fraud/datacenter/VPN
    const count = await prisma.trackingEvent.count({
      where: {
        eventType: 'click',
        isInvalid: true,
        isFraud: false, // Exclude fraud
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching invalid clicks:', error);
    return NextResponse.json({ count: 0 });
  }
}
