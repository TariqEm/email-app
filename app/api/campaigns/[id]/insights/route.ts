import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type TrackingEventData = {
  eventType: string;
  os: string | null;
  browser: string | null;
  country: string | null;
  city: string | null;
  deviceType: string | null;
  timezone: string | null;
  emailList: { email: string } | null;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log('Fetching insights for campaign:', id);

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!campaign) {
      console.error('Campaign not found:', id);
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    console.log('Campaign found:', campaign.name);

    // Fetch ALL tracking events (both valid and invalid)
    const trackingEvents = await prisma.trackingEvent.findMany({
      where: {
        campaignId: id,
        // REMOVED: isInvalid filter - now shows all events
      },
      select: {
        eventType: true,
        os: true,
        browser: true,
        country: true,
        city: true,
        deviceType: true,
        timezone: true,
        emailList: {
          select: {
            email: true,
          },
        },
      },
    });

    console.log('Tracking events found:', trackingEvents.length);

    // Helper function to aggregate data
    function aggregateBy(field: string) {
      const groups: Record<string, { total: number; opened: number; clicked: number; unsubscribed: number }> = {};

      trackingEvents.forEach((event: TrackingEventData) => {
        let key: string; // Changed from 'let key = string;'
        
        // Special handling for email domains
        if (field === 'emailDomain') {
          const email = event.emailList?.email;
          key = email ? email.split('@')[1] || 'Unknown' : 'Unknown';
        } else {
          const value = event[field as keyof Omit<TrackingEventData, 'emailList'>];
          key = (typeof value === 'string' ? value : null) || 'Unknown';
        }

        if (!groups[key]) {
          groups[key] = { total: 0, opened: 0, clicked: 0, unsubscribed: 0 };
        }

        groups[key].total++;
        if (event.eventType === 'open') groups[key].opened++;
        if (event.eventType === 'click') groups[key].clicked++;
        if (event.eventType === 'unsubscribe') groups[key].unsubscribed++;
      });

      return Object.entries(groups).map(([name, stats]) => ({
        name,
        totalRecords: stats.total,
        opened: {
          count: stats.opened,
          percent: stats.total > 0 ? (stats.opened / stats.total) * 100 : 0,
        },
        clicked: {
          count: stats.clicked,
          percent: stats.total > 0 ? (stats.clicked / stats.total) * 100 : 0,
        },
        unsubscribed: {
          count: stats.unsubscribed,
          percent: stats.total > 0 ? (stats.unsubscribed / stats.total) * 100 : 0,
        },
      })).sort((a, b) => b.totalRecords - a.totalRecords);
    }

    const insights = {
      campaignName: campaign.name,
      operatingSystems: aggregateBy('os'),
      browsers: aggregateBy('browser'),
      locations: aggregateBy('country'),
      cities: aggregateBy('city'),
      deviceTypes: aggregateBy('deviceType'),
      timezones: aggregateBy('timezone'),
      emailDomains: aggregateBy('emailDomain'),
    };

    return NextResponse.json(insights);
  } catch (error) {
    console.error('Error fetching campaign insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
