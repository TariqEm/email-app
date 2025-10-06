import { decrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client'; // Import Prisma namespace for types
import { PlatformKey, sponsorConfigs } from '@/lib/sponsor-config';
import axios from 'axios';

export async function createSponsorAndSync(data: {
  name: string;
  api_driver: PlatformKey | string;
  affiliate_number?: string;
  api_key?: string;
  username?: string;
  password?: string;
  api_url_offer?: string;
  api_url_reporting?: string;
  login_driver?: string;
  tracking_template?: string;
  status?: 'active' | 'inactive';
}) {
  // Basic validation
  if (!data.name || !data.api_driver) throw new Error('Missing required fields');
  
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create sponsor
    const sponsor = await tx.sponsor.create({
      data: {
        name: data.name,
        api_driver: data.api_driver,
        affiliate_number: data.affiliate_number,
        api_key: data.api_key,
        username: data.username,
        password: data.password,
        api_url_offer: data.api_url_offer,
        api_url_reporting: data.api_url_reporting,
        login_driver: data.login_driver,
        tracking_template: data.tracking_template,
        status: data.status || 'active',
      },
    });

    // Sync Affiliate Manager
    await syncAffiliateManagerTx(tx, sponsor);

    return sponsor;
  });
}

/**
 * Sync affiliate manager within transaction context
 */
async function syncAffiliateManagerTx(tx: Prisma.TransactionClient, sponsor: { id: string; api_key?: string | null; api_driver: string }) {
  const config = sponsorConfigs[sponsor.api_driver as PlatformKey];
  if (!config?.affiliateInfoUrl) throw new Error('Affiliate info URL not configured for this platform');

  // Decrypt API key if needed (plain string expected)
  const apiKey = sponsor.api_key ? decrypt(sponsor.api_key) : '';

  const res = await axios.get(config.affiliateInfoUrl, {
    headers: {
      'X-Eflow-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  const data = res.data;
  const manager = data.relationship?.account_manager;
  if (!manager) throw new Error('Affiliate manager data missing');

  const fullName = [manager.first_name, manager.last_name].filter(Boolean).join(' ');
  const email = manager.email || '';
  const telegram = null; // extend if available
  const referralLink = data.relationship?.affiliate_referral_link || null;

  await tx.affiliateManager.upsert({
    where: { sponsorId: sponsor.id },
    update: {
      fullName,
      email,
      telegram,
      referralLink,
      updatedAt: new Date(),
    },
    create: {
      sponsorId: sponsor.id,
      fullName,
      email,
      telegram,
      referralLink,
    },
  });
}


export async function deleteSponsor(sponsorId: string) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Find all offers linked to this sponsor
    const offers = await tx.offer.findMany({ where: { sponsorId } });
    
    // Get offer IDs
    const offerIds = offers.map(o => o.id);

    // Delete all campaigns related to these offers
    if (offerIds.length > 0) {
      await tx.campaign.deleteMany({ where: { offerId: { in: offerIds } } });
    }

    // Delete all offers for this sponsor
    await tx.offer.deleteMany({ where: { sponsorId } });

    // Finally, delete the sponsor
    const deletedSponsor = await tx.sponsor.delete({ where: { id: sponsorId } });

    return deletedSponsor;
  });
}