import { NextResponse } from 'next/server';
import { modelFeatures, testModel, safeModelError } from '@/server/models/settings';
import { requireLocalMutation } from '@/server/http/local';
export const runtime = 'nodejs';
export async function POST(request: Request) {
 try { requireLocalMutation(request); const {feature} = await request.json(); if (!modelFeatures.includes(feature)) throw new Error('请选择功能'); return NextResponse.json(await testModel(feature)); }
 catch(error) { return NextResponse.json({error:safeModelError(error)},{status:422}); }
}
