import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Spark Distributors Whatsapp Automation",
  description: "Manage WhatsApp bot products, orders, and automated customer responses",
  applicationName: "Spark Distributors Whatsapp Automation",
  icons: {
    icon: "/_C9BFF9E0-617F-45DD-91B5-57549414608C_-removebg-preview.png",
    apple: "/_C9BFF9E0-617F-45DD-91B5-57549414608C_-removebg-preview.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
