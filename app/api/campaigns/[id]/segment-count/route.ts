import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    
    const os = searchParams.get('os');
    const browser = searchParams.get('browser');
    const country = searchParams.get('country');
    const deviceType = searchParams.get('deviceType');
    const eventType = searchParams.get('eventType');

    const whereClause: Prisma.TrackingEventWhereInput = {
      campaignId: id,
      isInvalid: false,
    };

    if (os && os !== 'all') whereClause.os = os;
    if (browser && browser !== 'all') whereClause.browser = browser;
    if (country && country !== 'all') whereClause.country = country;
    if (deviceType && deviceType !== 'all') whereClause.deviceType = deviceType;
    if (eventType && eventType !== 'all') whereClause.eventType = eventType as 'open';

    // Count distinct email addresses matching the filters
    const count = await prisma.trackingEvent.findMany({
      where: whereClause,
      select: {
        emailListId: true,
      },
      distinct: ['emailListId'],
    });

    return NextResponse.json({ count: count.length });
  } catch (error) {
    console.error('Error counting segmented emails:', error);
    return NextResponse.json({ count: 0 });
  }
}
