# 🎬 VideoAI - יצירת סרטונים עם בינה מלאכותית

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)]()

**אתר בעברית ליצירת סרטוני תדמית ופרסום באמצעות בינה מלאכותית מתקדמת.**

ספר לנו על העסק שלך בשיחה פשוטה עם צ'אטבוט AI, ונייצר לך סרטון מקצועי תוך כמה דקות.

---

## ✨ תכונות

- 💬 **צ'אטבוט AI חכם** - שיחה טבעית בעברית שמנחה אותך צעד אחר צעד
- 🎥 **יצירת וידאו אוטומטית** - Runway ML Gen-4 + Veo3.1
- 🎨 **התאמה אישית** - לוגו, צבעי מותג, סגנון, קהל יעד
- 👤 **מערכת משתמשים מלאה** - הרשמה, התחברות, היסטוריית סרטונים
- 📱 **Responsive** - עובד מצוין על מובייל ודסקטופ
- 🌐 **RTL מלא** - ממשק מותאם לעברית

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd video

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# ערוך את .env.local עם ה-API keys שלך

# Run database migrations
npx prisma migrate dev
npx prisma generate

# Start dev server
npm run dev
```

פתח [http://localhost:3000](http://localhost:3000) בדפדפן

📖 **הוראות מפורטות**: ראה [SETUP.md](./SETUP.md)

---

## 🛠 טכנולוגיות

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) + [Prisma](https://www.prisma.io/)
- **Authentication**: [Auth.js v5](https://authjs.dev/)
- **AI Chat**: [OpenRouter](https://openrouter.ai/)
- **Video Generation**: [Runway ML](https://runwayml.com/)
- **File Upload**: [UploadThing](https://uploadthing.com/)

---

## 📸 Screenshots

_הוסף screenshots כאן_

---

## 🔑 Environment Variables

יש להגדיר ב-`.env.local`:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `NEXTAUTH_SECRET` | Auth.js secret key | ✅ |
| `OPENROUTER_API_KEY` | OpenRouter API key | ✅ |
| `RUNWAYML_API_SECRET` | Runway ML API secret | ✅ |
| `UPLOADTHING_TOKEN` | UploadThing token | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ❌ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ❌ |

---

## 📂 מבנה הפרויקט

```
├── src/
│   ├── app/                  # Next.js pages & API routes
│   │   ├── (auth)/          # Authentication pages
│   │   ├── (dashboard)/     # Protected dashboard pages
│   │   └── api/             # Backend API endpoints
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui base components
│   │   ├── auth/            # Auth forms
│   │   ├── chat/            # Chat interface components
│   │   ├── video/           # Video player & gallery
│   │   └── layout/          # Layout components
│   ├── lib/                 # Core libraries
│   │   ├── auth.ts          # Auth configuration
│   │   ├── openrouter.ts    # AI client
│   │   ├── runway.ts        # Video generation
│   │   └── prompts/         # AI prompts
│   ├── hooks/               # Custom React hooks
│   └── types/               # TypeScript types
└── prisma/
    └── schema.prisma        # Database schema
```

---

## 🤝 תרומה

Contributions are welcome! Feel free to open issues or pull requests.

---

## 📄 רישיון

MIT License - ראה [LICENSE](./LICENSE) לפרטים

---

**נבנה עם ❤️ על ידי Claude Code**
