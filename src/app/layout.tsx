import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spark Distributors Whatsapp Automation",
  description: "Manage WhatsApp bot products, orders, and automated customer responses",
  applicationName: "Spark Distributors Whatsapp Automation",
  icons: {
    icon: "/_C9BFF9E0-617F-45DD-91B5-57549414608C_-removebg-preview.png",
    apple: "/_C9BFF9E0-617F-45DD-91B5-57549414608C_-removebg-preview.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
