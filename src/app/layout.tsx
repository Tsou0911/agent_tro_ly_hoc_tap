import type { Metadata } from "next";
import "./globals.css";
import "./account.css";

export const metadata: Metadata = {
  title: {default: "LinguaCompanion · Học ngoại ngữ", template: "%s · LinguaCompanion"},
  description: "Không gian học ngoại ngữ theo chu trình lên kế hoạch, luyện tập và nhìn lại."
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="vi"><body>{children}</body></html>;
}
