import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "sonner";
import "./globals.css";

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
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased" style={{ fontFamily: "'Heebo', sans-serif" }} suppressHydrationWarning>
        <AuthProvider>
          {children}
          <Toaster position="top-center" dir="rtl" />
        </AuthProvider>
      </body>
    </html>
  );
}
