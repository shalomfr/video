"use client";

import { useSession } from "next-auth/react";
import { User } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-muted-foreground mt-1">ניהול החשבון שלך</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt="Avatar"
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <User className="w-8 h-8 text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {session?.user?.name || "משתמש"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {session?.user?.email}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">שם</label>
            <input
              type="text"
              defaultValue={session?.user?.name || ""}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">אימייל</label>
            <input
              type="email"
              defaultValue={session?.user?.email || ""}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
              disabled
              dir="ltr"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          ניהול פרופיל מתקדם יתווסף בקרוב
        </p>
      </div>
    </div>
  );
}
