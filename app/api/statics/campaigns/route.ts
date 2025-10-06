import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ campaigns: [] });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      return NextResponse.json({ campaigns: [] });
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        isActive: true,
      },
      include: {
        offer: {
          select: {
            name: true,
            sponsor: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const campaignStatsPromises = campaigns.map(async (campaign) => {
      const trackingEvents = await prisma.trackingEvent.findMany({
        where: {
          campaignId: campaign.id,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          eventType: true,
          emailHash: true,
          ip: true,
          isInvalid: true,
        },
      });

      // Count unique events by emailHash + IP + eventType
      const uniqueOpens = new Set<string>();
      const uniqueClicks = new Set<string>();
      const uniqueUnsubs = new Set<string>();
      
      let totalOpens = 0;
      let totalClicks = 0;
      let totalUnsubs = 0;
      let invalidOpens = 0;
      let invalidClicks = 0;
      let invalidUnsubs = 0;

      trackingEvents.forEach((event) => {
        const uniqueKey = `${event.emailHash}-${event.ip}`;
        
        if (event.eventType === 'open') {
          totalOpens++;
          if (!event.isInvalid) {
            uniqueOpens.add(uniqueKey);
          } else {
            invalidOpens++;
          }
        } else if (event.eventType === 'click') {
          totalClicks++;
          if (!event.isInvalid) {
            uniqueClicks.add(uniqueKey);
          } else {
            invalidClicks++;
          }
        } else if (event.eventType === 'unsubscribe') {
          totalUnsubs++;
          if (!event.isInvalid) {
            uniqueUnsubs.add(uniqueKey);
          } else {
            invalidUnsubs++;
          }
        }
      });

      const uniqueOpensCount = uniqueOpens.size;
      const uniqueClicksCount = uniqueClicks.size;
      const uniqueUnsubsCount = uniqueUnsubs.size;

      return {
        id: campaign.id,
        name: campaign.name,
        offerName: campaign.offer.name,
        sponsorName: campaign.offer.sponsor.name,
        targetCountries: campaign.targetCountries,
        opens: uniqueOpensCount,
        clicks: uniqueClicksCount,
        unsubs: uniqueUnsubsCount,
        // Extra info for tooltips
        opensExtra: {
          total: totalOpens,
          unique: uniqueOpensCount,
          duplicates: totalOpens - uniqueOpensCount - invalidOpens,
          invalid: invalidOpens,
        },
        clicksExtra: {
          total: totalClicks,
          unique: uniqueClicksCount,
          duplicates: totalClicks - uniqueClicksCount - invalidClicks,
          invalid: invalidClicks,
        },
        unsubsExtra: {
          total: totalUnsubs,
          unique: uniqueUnsubsCount,
          duplicates: totalUnsubs - uniqueUnsubsCount - invalidUnsubs,
          invalid: invalidUnsubs,
        },
        trackingPixelLink: campaign.trackingPixelLink,
        clickTrackingLink: campaign.clickTrackingLink,
        unsubTrackingLink: campaign.unsubTrackingLink,
      };
    });

    const campaignStats = await Promise.all(campaignStatsPromises);

    return NextResponse.json({ campaigns: campaignStats });
  } catch (error) {
    console.error('Error fetching campaign statistics:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch campaigns',
      details: error instanceof Error ? error.message : 'Unknown error',
      campaigns: [] 
    }, { status: 500 });
  }
}
