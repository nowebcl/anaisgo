import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anaís Agendamiento | Consulta Psicológica',
  description: 'Reserva tu espacio de bienestar y salud mental con la psicóloga Anaís de forma simple, segura y en tiempo real.',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col selection:bg-clinical-200 selection:text-clinical-800">
        {children}
      </body>
    </html>
  );
}
