import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roebling Tab — Apr 4",
  description: "Split the bill from Roebling Sporting Club",
  openGraph: {
    title: "Roebling Tab — Apr 4",
    description: "Claim what you had. Venmo Sanjit.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
