// app/api/upload/route.ts
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { processFile } from '@/lib/processor';

// Max upload file size in bytes
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
// Allowed MIME types for processing
const ALLOWED_TYPES = ['text/plain', 'text/csv'] as const;

export async function POST(request: Request) {
  // 1) Authenticate user session
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2) Parse multipart form data
  const formData = await request.formData();
  const file = formData.get('file');
  const chatId = formData.get('chatId');

  // 3) Validate file and chatId
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }
  if (typeof chatId !== 'string' || !chatId.trim()) {
    return NextResponse.json({ error: 'No chat ID provided' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File size exceeds 5MB' },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.includes(file.type as any)) {
    return NextResponse.json(
      {
        error: `Unsupported file type. Only ${ALLOWED_TYPES.join(
          ', ',
        )} allowed.`,
      },
      { status: 400 },
    );
  }

  // 4) Read file into buffer
  const rawBuffer = await file.arrayBuffer();

  try {
    // 5) Upload raw file to Vercel Blob storage
    const { url: fileUrl } = await put(file.name, rawBuffer, {
      access: 'public',
    });

    // 6) Process file: chunking, embedding, DB storage
    const result = await processFile({
      chatId,
      fileName: file.name,
      fileType: file.type,
      fileUrl,
      rawBuffer,
    });

    // 7) Return processing summary
    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload or processing error:', error);
    return NextResponse.json(
      { error: 'Failed to upload or process file' },
      { status: 500 },
    );
  }
}
