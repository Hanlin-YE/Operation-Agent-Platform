import { NextResponse } from 'next/server';
import { publicSettings, saveSettings, safeModelError } from '@/server/models/settings';
import { requireLocalMutation } from '@/server/http/local';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET() { try {return NextResponse.json(publicSettings(),{headers:{'Cache-Control':'no-store'}});}catch(error){return NextResponse.json({error:safeModelError(error)},{status:422});} }
export async function PUT(request: Request) {
 try { requireLocalMutation(request); return NextResponse.json(saveSettings(await request.json())); }
 catch(error) { return NextResponse.json({error:safeModelError(error)},{status:422}); }
}
