import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "sonner";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "יוצר סרטונים AI - צור סרטוני תדמית בקלות",
  description:
    "צור סרטוני תדמית ופרסום מקצועיים בעזרת בינה מלאכותית. שיחה בעברית, תוצאה מדהימה.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
          <Toaster position="top-center" dir="rtl" />
        </AuthProvider>
      </body>
    </html>
  );
}
