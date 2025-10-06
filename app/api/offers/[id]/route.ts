// app/api/offers/[id]/route.ts

import { NextResponse } from 'next/server';
import { deleteOffer } from '@/app/(admin)/offers/actions';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deleteOffer(id);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message || 'Failed to delete offer' }, { status: 400 });
    }
  }
}
