import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    // Read secure environment variables strictly available on the server side
    const correctUser = process.env.ADMIN_USERNAME || 'anais20';
    const correctPass = process.env.ADMIN_PASSWORD || 'D23!!!4M_';
    
    if (username === correctUser && password === correctPass) {
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { success: false, error: 'Credenciales incorrectas' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Error en login API:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
