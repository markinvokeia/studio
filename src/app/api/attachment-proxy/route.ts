import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileUrl = searchParams.get('url');

  if (!fileUrl) {
    return NextResponse.json({ message: 'URL parameter is missing' }, { status: 400 });
  }

  try {
    let urlToFetch = fileUrl;
    // Transform Google Drive viewer URL to a direct download link if applicable
    if (fileUrl.includes('drive.google.com')) {
        const fileIdMatch = fileUrl.match(/d\/(.+?)(?:\/|$)/);
        if (fileIdMatch && fileIdMatch[1]) {
            urlToFetch = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
        }
    }
    
    const fileResponse = await fetch(urlToFetch);

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
    }

    const blob = await fileResponse.blob();
    const headers = new Headers();
    headers.set('Content-Type', blob.type);
    
    return new NextResponse(blob, { status: 200, statusText: 'OK', headers });

  } catch (error) {
    console.error('Attachment proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: `Failed to fetch attachment: ${errorMessage}` }, { status: 500 });
  }
}
