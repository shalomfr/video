import Link from "next/link";
import { Film, MessageSquare, Download, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Film className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl">VideoAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-xl transition-colors"
          >
            התחברות
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
          >
            הרשמה
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center px-6 pt-20 pb-16">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          מופעל על ידי בינה מלאכותית
        </div>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          צור סרטוני תדמית
          <br />
          <span className="text-primary">בכמה דקות</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          ספר לנו על העסק שלך בשיחה פשוטה בעברית, ואנחנו ניצור לך סרטון תדמית
          מקצועי באמצעות בינה מלאכותית מתקדמת.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-lg hover:opacity-90 transition-opacity"
          >
            התחל ליצור סרטון
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border border-border rounded-xl font-medium text-lg hover:bg-muted transition-colors"
          >
            יש לי חשבון
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-border">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">שיחה בעברית</h3>
            <p className="text-muted-foreground">
              ספר לנו על העסק שלך בשיחה טבעית. ה-AI ישאל אותך שאלות ויבנה את
              הבריף המושלם.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-border">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-bold mb-2">יצירה אוטומטית</h3>
            <p className="text-muted-foreground">
              בינה מלאכותית מתקדמת יוצרת סרטון תדמית מותאם אישית על בסיס המידע
              שסיפקת.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-border">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
              <Download className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">הורד ושתף</h3>
            <p className="text-muted-foreground">
              הורד את הסרטון שלך באיכות גבוהה ושתף אותו ברשתות החברתיות או
              באתר העסק.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>VideoAI - יצירת סרטונים בבינה מלאכותית</p>
      </footer>
    </div>
  );
}
