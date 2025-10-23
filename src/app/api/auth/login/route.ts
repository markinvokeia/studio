
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Mock authentication logic
    if (email === 'info@invokeia.com' && password === 'admin') {
      // In a real app, you would generate a JWT here
      const user = { id: '1', name: 'Admin User', email: 'info@invokeia.com' };
      const token = 'mock-jwt-token'; // Replace with actual token generation

      return NextResponse.json({ user, token });
    } else {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'An internal error occurred' }, { status: 500 });
  }
}
