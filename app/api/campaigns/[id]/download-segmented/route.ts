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

    const trackingEvents = await prisma.trackingEvent.findMany({
      where: whereClause,
      include: {
        emailList: {
          select: {
            email: true,
            country: true,
          },
        },
      },
      distinct: ['emailListId'],
    });

    // Generate CSV
    const csvRows = ['Email,Country,OS,Browser,Device Type,Event Type'];
    
    trackingEvents.forEach(event => {
      if (event.emailList) {
        csvRows.push(
          `${event.emailList.email},${event.country || 'Unknown'},${event.os || 'Unknown'},${event.browser || 'Unknown'},${event.deviceType || 'Unknown'},${event.eventType}`
        );
      }
    });

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="segmented-emails.csv"',
      },
    });
  } catch (error) {
    console.error('Error generating segmented email list:', error);
    return new NextResponse('Error generating email list', { status: 500 });
  }
}
