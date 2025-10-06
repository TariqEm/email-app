// app/api/sponsors/route.ts
import { NextResponse } from 'next/server';
import { createSponsorAndSync, deleteSponsor } from '@/app/(admin)/sponsors/actions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const sponsor = await createSponsorAndSync(data);
    return NextResponse.json(sponsor, { status: 201 });
  } catch (error: unknown) {
    let message = 'Failed';
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  try {
    const sponsors = await prisma.sponsor.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ sponsors });
  } catch (error) {
    console.error('Error fetching sponsors:', error);
    return NextResponse.json({ sponsors: [], error: 'Failed to fetch sponsors' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sponsorId = searchParams.get('id');
    if (!sponsorId) {
      return NextResponse.json({ error: 'Sponsor ID is required' }, { status: 400 });
    }
    const deletedSponsor = await deleteSponsor(sponsorId);
    return NextResponse.json(deletedSponsor, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error){ 
      return NextResponse.json({ error: error.message || 'Failed to delete sponsor' }, { status: 400 });
    }
  }
}