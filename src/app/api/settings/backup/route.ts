import { NextResponse } from 'next/server';
import { createBackup } from '@/server/storage/backup';
import { requireLocalMutation } from '@/server/http/local';
export const runtime='nodejs';
export async function POST(request:Request){try{requireLocalMutation(request);return NextResponse.json({path:await createBackup()});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'备份失败'},{status:422});}}
