// app/(admin)/offers/actions.ts
import { prisma } from '@/lib/prisma';

export async function deleteOffer(offerId: string) {
  return await prisma.$transaction(async (tx) => {
    // Delete campaigns related to this offer
    await tx.campaign.deleteMany({ where: { offerId } });

    // Delete the offer
    const deletedOffer = await tx.offer.delete({ where: { id: offerId } });

    return deletedOffer;
  });
}