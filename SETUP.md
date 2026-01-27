# 🎬 VideoAI - מערכת יצירת סרטונים עם בינה מלאכותית

## ✅ מה נבנה

אתר Next.js 15 מלא עם:
- **צ'אטבוט AI בעברית** (OpenRouter) שמנהל שיחה ב-9 שלבים
- **יצירת וידאו אוטומטית** (Runway ML API)
- **מערכת משתמשים מלאה** (Auth.js v5 - Email/Password + Google OAuth)
- **העלאת קבצים** (UploadThing - ללוגו)
- **ממשק RTL בעברית** עם Tailwind CSS
- **Database** (Prisma + PostgreSQL)

---

## 📁 מבנה הפרויקט

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # דפי התחברות והרשמה
│   ├── (dashboard)/              # דפים מוגנים (dashboard, create, videos, briefs, settings)
│   └── api/                      # API routes (auth, chat, videos, briefs, conversations, uploadthing)
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── auth/                     # Login/Register forms
│   ├── chat/                     # Chat components (container, messages, input, widgets)
│   ├── video/                    # Video player, cards, status
│   └── layout/                   # Header, Sidebar, Navigation
├── lib/
│   ├── auth.ts                   # Auth.js configuration
│   ├── openrouter.ts             # OpenRouter AI client
│   ├── runway.ts                 # Runway ML video generation
│   ├── prisma.ts                 # Database client
│   ├── uploadthing.ts            # File upload client
│   ├── prompts/                  # AI system prompts (Hebrew conversation, brief extraction, video prompt)
│   └── validators/               # Zod schemas
├── hooks/                        # React hooks (use-chat, use-video-status)
├── stores/                       # Zustand stores
└── types/                        # TypeScript types

prisma/
└── schema.prisma                 # Database schema (Users, Conversations, Messages, Briefs, Videos)
```

---

## 🚀 הפעלה מהירה

### שלב 1: התקנת תלויות
```bash
cd "c:\cursor project\video"
npm install
```

### שלב 2: הגדרת משתנים סביבתיים
כבר יש לך קובץ [`.env.local`](file://c:/cursor%20project/video/.env.local) - תצטרך למלא בו:

#### 1. **PostgreSQL Database** (חובה)
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
```

**אופציות:**
- **מקומי**: התקן PostgreSQL ב-localhost
- **Cloud**: השתמש ב-[Neon](https://neon.tech/) (בחינם), [Supabase](https://supabase.com/), או [Vercel Postgres](https://vercel.com/storage/postgres)

#### 2. **OpenRouter API Key** (חובה - לצ'אטבוט)
```env
OPENROUTER_API_KEY="sk-or-v1-..."
```
קבל API key מ-[https://openrouter.ai/](https://openrouter.ai/)

#### 3. **Runway ML API Secret** (חובה - ליצירת וידאו)
```env
RUNWAYML_API_SECRET="..."
```
קבל API key מ-[https://runwayml.com/](https://runwayml.com/)

#### 4. **UploadThing Token** (חובה - להעלאת לוגו)
```env
UPLOADTHING_TOKEN="..."
```
קבל token מ-[https://uploadthing.com/](https://uploadthing.com/)

#### 5. **Google OAuth** (אופציונלי)
```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```
הגדר ב-[Google Cloud Console](https://console.cloud.google.com/)

### שלב 3: הרצת Migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### שלב 4: הפעלת שרת הפיתוח
```bash
npm run dev
```

פתח בדפדפן: [http://localhost:3000](http://localhost:3000)

---

## 🎯 זרימת השימוש

1. **הרשמה** → [/register](http://localhost:3000/register)
2. **התחברות** → [/login](http://localhost:3000/login)
3. **יצירת סרטון** → [/create](http://localhost:3000/create)
   - AI מנהל שיחה בעברית ב-9 שלבים:
     1. ברכה וסוג סרטון
     2. פרטי עסק (שם, תחום, תיאור)
     3. העלאת לוגו (אופציונלי)
     4. צבעי מותג וסגנון
     5. קהל יעד
     6. אורך סרטון (5 או 10 שניות)
     7. מצב רוח (אנרגטי/רגוע/חם/יוקרתי/שמח)
     8. סיכום ואישור
     9. יצירת הסרטון (3-5 דקות)
4. **צפייה בסרטון** → [/videos](http://localhost:3000/videos)
5. **הורדת הסרטון**

---

## 🧪 בדיקה

```bash
# Build production
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

## 📦 טכנולוגיות

- **Framework**: Next.js 15 (App Router, TypeScript)
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Auth.js v5 (NextAuth)
- **AI Chat**: OpenRouter → Claude/GPT
- **Video Generation**: Runway ML Gen-4 + Veo3.1
- **File Upload**: UploadThing
- **Forms**: React Hook Form + Zod
- **State**: Zustand

---

## 🔑 API Keys שתצטרך

| Service | Purpose | Link | Free Tier? |
|---------|---------|------|------------|
| **OpenRouter** | AI Chat | [openrouter.ai](https://openrouter.ai/) | כן (pay-as-you-go) |
| **Runway ML** | Video Generation | [runwayml.com](https://runwayml.com/) | קרדיטים התחלתיים |
| **UploadThing** | File Upload | [uploadthing.com](https://uploadthing.com/) | כן (2GB חינם) |
| **Neon/Supabase** | PostgreSQL | [neon.tech](https://neon.tech/) | כן |

---

## 🐛 בעיות נפוצות

### 1. שגיאת DATABASE_URL
```
Error: P1001: Can't reach database server
```
**פתרון**: ודא ש-PostgreSQL רץ, וה-`DATABASE_URL` ב-`.env.local` נכון.

### 2. שגיאת OpenRouter 401
```
Error: Unauthorized
```
**פתרון**: בדוק ש-`OPENROUTER_API_KEY` ב-`.env.local` נכון.

### 3. שגיאת Prisma
```
Error: Prisma schema not found
```
**פתרון**: הרץ `npx prisma generate`

---

## 📝 הערות חשובות

1. **RTL Support**: כל ה-UI בנוי עם CSS logical properties (`ps-`, `pe-`, `ms-`, `me-`) לתמיכה ב-RTL
2. **Hebrew Font**: משתמש בגופן Heebo מ-Google Fonts
3. **Streaming**: Chat API מחזיר SSE stream לתגובות real-time
4. **Video Status**: מעקב אחר סטטוס יצירת הוידאו דרך SSE polling

---

## 🎉 מוכן!

הכל מוכן. עכשיו רק צריך:
1. ✅ למלא API keys ב-`.env.local`
2. ✅ להריץ migrations
3. ✅ להפעיל `npm run dev`
4. ✅ להירשם ולהתחיל ליצור סרטונים!

---

**נוצר על ידי Claude Code** 🤖
