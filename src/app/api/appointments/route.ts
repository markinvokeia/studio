import {NextRequest, NextResponse} from 'next/server';
import {format, addMonths} from 'date-fns';

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const userEmail = searchParams.get('attendeesEmails');

  if (!userEmail) {
    return NextResponse.json(
      {error: 'attendeesEmails is required'},
      {status: 400}
    );
  }

  const now = new Date();
  const startDate = addMonths(now, -6);
  const endDate = addMonths(now, 6);
  const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');

  const params = new URLSearchParams({
    startingDateAndTime: formatDateForAPI(startDate),
    endingDateAndTime: formatDateForAPI(endDate),
    attendeesEmails: userEmail,
  });

  try {
    const response = await fetch(
      `https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users_appointments?${params.toString()}`,
      {
        method: 'GET',
        mode: 'cors',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {error: `Error HTTP: ${response.status} - ${errorText}`},
        {status: response.status}
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to fetch appointments:', error);
    return NextResponse.json(
      {error: 'Failed to fetch appointments'},
      {status: 500}
    );
  }
}
