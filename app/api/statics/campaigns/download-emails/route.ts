import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const type = searchParams.get('type') || 'all';

    if (!campaignId || !startDateStr || !endDateStr) {
      return new NextResponse('Missing parameters', { status: 400 });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Build query with proper typing
    const whereClause: Prisma.TrackingEventWhereInput = {
      campaignId,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
      isInvalid: false,
    };

    // Filter by event type if not "all"
    if (type === 'opens') {
      whereClause.eventType = 'open';
    } else if (type === 'clicks') {
      whereClause.eventType = 'click';
    } else if (type === 'unsubs') {
      whereClause.eventType = 'unsubscribe';
    }

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
    const csvRows = ['Email,Country,Event Type,Timestamp'];
    
    trackingEvents.forEach(event => {
      if (event.emailList) {
        const timestamp = event.timestamp.toISOString();
        csvRows.push(
          `${event.emailList.email},${event.emailList.country || 'Unknown'},${event.eventType},${timestamp}`
        );
      }
    });

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="campaign-${type}-emails.csv"`,
      },
    });
  } catch (error) {
    console.error('Error generating email list:', error);
    return new NextResponse('Error generating email list', { status: 500 });
  }
}
