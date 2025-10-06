import { NextResponse } from 'next/server';
import { createCampaign } from '@/app/(admin)/campaigns/actions';

export async function POST(req: Request) {
  try {
    const {
      sponsorId,
      offerId,
      campaignName,
      targetCountries,
      status,
      startDate,
      endDate,
      trackingDomainId,
      cortexClickTracking,
      cortexUnsbTracking,
    } = await req.json();

    if (!sponsorId || !offerId || !campaignName || !targetCountries) {
      return NextResponse.json(
        { error: 'Missing required fields: sponsorId, offerId, campaignName, targetCountries' },
        { status: 400 }
      );
    }

    const campaignData = {
      sponsorId,
      offerId,
      campaignName,
      targetCountries,
      status,
      startDate,
      endDate,
      trackingDomainId,
      cortexClickTracking,
      cortexUnsbTracking,
    };

    const campaign = await createCampaign(campaignData);

    return NextResponse.json(campaign, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message || 'Failed to create campaign' }, { status: 400 });
    }
  }
}
