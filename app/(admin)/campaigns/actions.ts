import { decrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { PlatformKey, sponsorConfigs } from '@/lib/sponsor-config';
import { encodeTrackingToken } from '@/lib/tracking/link-decoder';
import axios from 'axios';

// const testEmail = 't.elmoktadi@outlook.com';

export async function createCampaign(data: {
  sponsorId: string;
  offerId: string;
  campaignName: string;
  targetCountries: string[];
  status?: 'active' | 'inactive';
  startDate?: Date | string;
  endDate?: Date | string;
  trackingDomainId?: string;
  cortexClickTracking?: string;
  cortexUnsbTracking?: string;
}) {
  // DEBUG: Log incoming data
  console.log('=== createCampaign RECEIVED data ===');
  console.log('cortexClickTracking:', data.cortexClickTracking);
  console.log('cortexUnsbTracking:', data.cortexUnsbTracking);
  console.log('Full data:', JSON.stringify(data, null, 2));
  
  // Validate minimal required fields
  if (!data.sponsorId || !data.offerId || !data.campaignName || !data.targetCountries) {
    throw new Error('Missing required fields');
  }

  // Find sponsor and decrypt api key
  const sponsor = await prisma.sponsor.findUnique({ where: { id: data.sponsorId } });
  if (!sponsor) throw new Error('Sponsor not found');

  const apiKey = sponsor.api_key ? decrypt(sponsor.api_key) : '';
  const config = sponsorConfigs[sponsor.api_driver as PlatformKey];
  if (!config) throw new Error('Sponsor platform config not found');

  // Fetch offer data from sponsor platform API
  const offerResponse = await axios.get(`${config.api_url_offer}${data.offerId}`, {
    headers: {
      'X-Eflow-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  const offerData = offerResponse.data;

  // Extract tracking and unsubscribe URLs
  const offerTrackingLink = offerData.redirect_tracking_url ?? null;
  const unsbTrackingLink = offerData.relationship?.integrations?.optizmo?.optout_link ?? null;

  // Extract payoutType
  let payoutType: string | null = null;
  const payouts = offerData.relationship?.payouts?.entries;
  if (Array.isArray(payouts) && payouts.length > 0) {
    payoutType = payouts[0].payout_type ?? null;
  }

  const optizmoKey = offerData.relationship?.integrations?.optizmo?.mailer_access_key ?? null;

  // Extract allowedCountries as string array
  const allowedCountriesRaw = offerData.relationship?.ruleset?.countries ?? [];
  const allowedCountries = Array.isArray(allowedCountriesRaw)
    ? allowedCountriesRaw.map((c: { label: string }) => c.label).filter(Boolean)
    : [];

  // Vertical extraction and find/create in DB
  const verticalName = offerData.relationship?.category?.name;
  let vertical = null;
  if (verticalName) {
    const verticalSlug = verticalName.toLowerCase().replace(/\s+/g, '-');
    vertical = await prisma.vertical.findUnique({ where: { slug: verticalSlug } });
    if (!vertical) {
      vertical = await prisma.vertical.create({
        data: { name: verticalName, slug: verticalSlug, isActive: true },
      });
    }
  }

  const externalOfferId =
    offerData.id ||
    offerData.externalOfferId ||
    offerData.network_offer_id?.toString() || // fallback
    null;

  if (!externalOfferId) {
    throw new Error('Missing externalOfferId in offer data');
  }

  // Upsert the Offer
  const offer = await prisma.offer.upsert({
    where: { externalOfferId },
    update: {
      name: offerData.name ?? 'Unknown',
      offerTrackingLink,
      unsbTrackingLink,
      payoutType,
      optizmoKey,
      allowedCountries,
      payoutAmount:
        offerData.relationship?.payouts?.entries && offerData.relationship.payouts.entries.length
          ? offerData.relationship.payouts.entries[0].payout_amount || 0
          : 0,
      payoutCurrency: offerData.currency ?? 'USD',
      sponsorId: data.sponsorId,
      verticalId: vertical ? vertical.id : null,
      geoTargeting: offerData.geoTargeting ?? null,
      isActive: true,
    },
    create: {
      externalOfferId,
      name: offerData.name ?? 'Unknown',
      offerTrackingLink,
      unsbTrackingLink,
      payoutType,
      optizmoKey,
      allowedCountries,
      payoutAmount:
        offerData.relationship?.payouts?.entries && offerData.relationship.payouts.entries.length
          ? offerData.relationship.payouts.entries[0].payout_amount || 0
          : 0,
      payoutCurrency: offerData.currency ?? 'USD',
      sponsorId: data.sponsorId,
      verticalId: vertical ? vertical.id : null,
      geoTargeting: offerData.geoTargeting ?? null,
      isActive: true,
    },
  });

  // Create the Campaign - FIXED: Use null instead of empty string
  const campaign = await prisma.campaign.create({
    data: {
      offerId: offer.id,
      name: data.campaignName,
      destinationUrl: offerTrackingLink ?? '',
      unsubscribeUrl: unsbTrackingLink ?? '',
      isActive: data.status === 'active' || !data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      targetCountries: data.targetCountries,
      trackingDomainId: data.trackingDomainId || null,
      cortexClickTracking: data.cortexClickTracking || null,
      cortexUnsbTracking: data.cortexUnsbTracking || null,
    },
  });
  
  console.log('=== Campaign CREATED with ===');
  console.log('cortexClickTracking:', campaign.cortexClickTracking);
  console.log('cortexUnsbTracking:', campaign.cortexUnsbTracking);

  // Generate tracking pixel link now that campaign.id exists
  const trackingToken = encodeTrackingToken({
    event: 'open',
    offerId: offer.id,
    campaignId: campaign.id,
    email: '%EMAIL%',
  });
  const trackingPixelLink = `http://localhost:3000/api/rd/${trackingToken}=%EMAIL%`;

  const clickTrackingToken = encodeTrackingToken({
    event: 'click',
    offerId: offer.id,
    campaignId: campaign.id,
    email: '%EMAIL%',
  });

  const clickTrackingLink = `http://localhost:3000/api/ct/${clickTrackingToken}=%EMAIL%`;

  const unsubTrackingToken = encodeTrackingToken({
    event: 'unsubscribe',
    offerId: offer.id,
    campaignId: campaign.id,
    email: '%EMAIL%',
  });

  const unsubTrackingLink = `http://localhost:3000/api/us/${unsubTrackingToken}=%EMAIL%`;



  // Update campaign with trackingPixelLink
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { trackingPixelLink, clickTrackingLink, unsubTrackingLink },
  });

  const updatedCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id } });

  return updatedCampaign;
}

export async function deleteCampaign(campaignId: string) {
  const deleted = await prisma.campaign.delete({
    where: { id: campaignId },
  });
  return deleted;
}