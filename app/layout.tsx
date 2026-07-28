import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: "달빛 윷마당 | 친구와 실시간 윷놀이",
    description: "AI 없이 2–4명이 방 코드로 모여 즐기는 실시간 웹 윷놀이",
    openGraph: { title: "달빛 윷마당", description: "둘이 모이면, 윷판이 열린다", images: [image] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="ko"><body>{children}</body></html>;
}
