// app/api/campaigns/[id]/route.ts

import { NextResponse } from 'next/server';
import { deleteCampaign } from '@/app/(admin)/campaigns/actions';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deleteCampaign(id);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message || 'Failed to delete campaign' }, { status: 400 });
    }
  }
}
