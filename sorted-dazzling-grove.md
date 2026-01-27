# תוכנית: אתר יצירת סרטונים עם AI בעברית

## סקירה כללית
אתר בעברית (RTL) המשתמש בצ'אטבוט AI (OpenRouter) שמנהל שיחה עם המשתמש, אוסף מידע על העסק שלו (לוגו, צבעים, קהל יעד, סוג סרטון וכו'), ומייצר סרטון תדמית/פרסום באמצעות Runway ML API.

## טכנולוגיות
- **Framework**: Next.js 15 (App Router, TypeScript)
- **AI צ'אט**: OpenRouter API → Claude/GPT לניהול שיחה בעברית
- **יצירת וידאו**: Runway ML API (Gen-4)
- **DB**: PostgreSQL + Prisma ORM
- **Auth**: Auth.js v5 (email/password + Google OAuth)
- **Upload**: UploadThing (לוגו)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: Zustand

---

## מבנה הפרויקט

```
src/
├── app/
│   ├── layout.tsx                    # Root: RTL, Hebrew font, AuthProvider
│   ├── page.tsx                      # Landing page
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Sidebar + Header
│   │   ├── dashboard/page.tsx        # Overview
│   │   ├── create/page.tsx           # Chat interface ליצירת סרטון
│   │   ├── videos/page.tsx           # גלריית סרטונים
│   │   ├── videos/[id]/page.tsx      # פרטי סרטון + נגן
│   │   ├── briefs/page.tsx           # רשימת בריפים
│   │   ├── briefs/[id]/page.tsx      # פרטי בריף
│   │   └── settings/page.tsx         # הגדרות משתמש
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── auth/register/route.ts
│       ├── chat/route.ts             # POST: streaming AI chat
│       ├── conversations/route.ts
│       ├── conversations/[id]/route.ts
│       ├── briefs/route.ts
│       ├── briefs/[id]/route.ts
│       ├── briefs/[id]/confirm/route.ts
│       ├── videos/route.ts
│       ├── videos/[id]/route.ts
│       ├── videos/[id]/status/route.ts  # SSE polling
│       └── uploadthing/
├── lib/
│   ├── prisma.ts
│   ├── auth.ts                       # Auth.js config
│   ├── openrouter.ts                 # OpenRouter client
│   ├── runway.ts                     # Runway ML client
│   ├── prompts/
│   │   ├── system-prompt.ts          # System prompt בעברית לשיחה
│   │   ├── brief-extraction.ts       # חילוץ בריף מובנה מהשיחה
│   │   └── video-prompt.ts           # יצירת prompt באנגלית ל-Runway
│   ├── validators/                   # Zod schemas
│   └── utils.ts
├── components/
│   ├── ui/                           # shadcn/ui
│   ├── layout/                       # header, sidebar, mobile-nav
│   ├── auth/                         # login-form, register-form
│   ├── chat/
│   │   ├── chat-container.tsx        # מנהל מצב השיחה
│   │   ├── message-list.tsx
│   │   ├── message-bubble.tsx
│   │   ├── chat-input.tsx
│   │   ├── logo-upload.tsx           # העלאת לוגו בתוך הצ'אט
│   │   ├── color-picker.tsx          # בחירת צבעי מותג
│   │   ├── typing-indicator.tsx
│   │   └── brief-summary.tsx         # כרטיס סיכום לאישור
│   ├── video/
│   │   ├── video-player.tsx
│   │   ├── video-card.tsx
│   │   ├── generation-progress.tsx   # מצב התקדמות יצירת סרטון
│   │   └── video-download.tsx
│   └── brief/
├── hooks/
│   ├── use-chat.ts                   # Hook ללוגיקת צ'אט + streaming
│   ├── use-video-status.ts           # Hook ל-SSE מעקב סטטוס
│   └── use-brief.ts
├── stores/
│   └── conversation-store.ts         # Zustand
└── types/
    ├── chat.ts
    ├── brief.ts
    └── video.ts
```

---

## סכמת מסד נתונים (Prisma)

### טבלאות עיקריות:
- **User** — id, name, email, passwordHash, image, timestamps
- **Account** — OAuth accounts (Google)
- **Session** — user sessions
- **Conversation** — id, userId, title, status (ACTIVE/BRIEF_READY/GENERATING/COMPLETED/FAILED)
- **Message** — id, conversationId, role (SYSTEM/USER/ASSISTANT), content, metadata (JSON)
- **Brief** — id, conversationId, userId + שדות מובנים:
  - videoType, businessName, industry, businessDesc
  - logoUrl, brandColors (JSON), style
  - targetAudience, videoLength, mood, additionalNotes
  - generatedPrompt (prompt באנגלית ל-Runway)
  - isConfirmed
- **Video** — id, conversationId, briefId, userId
  - runwayTaskId, status (PENDING/PROCESSING/COMPLETED/FAILED)
  - prompt, model, duration, ratio
  - videoUrl, thumbnailUrl, errorMessage

---

## זרימת השיחה עם ה-AI

### System Prompt (עברית):
ה-AI מנהל שיחה בעברית ב-9 שלבים:
1. **ברכה** — הסבר קצר + שאלה על סוג הסרטון
2. **סוג סרטון** — תדמית / פרסומי / רשתות חברתיות / מוצר
3. **פרטי עסק** — שם, תחום, תיאור
4. **לוגו** — בקשה להעלאה (אופציונלי) → `[TRIGGER:LOGO_UPLOAD]`
5. **צבעים וסגנון** — צבעי מותג + סגנון → `[TRIGGER:COLOR_PICKER]`
6. **קהל יעד** — גיל, מגדר, תחומי עניין, מיקום
7. **אורך סרטון** — 5 שניות / 10 שניות
8. **מצב רוח** — אנרגטי / רגוע / חם / יוקרתי / שמח
9. **סיכום ואישור** → `[BRIEF_CONFIRMED]`

### מנגנון Triggers:
הקוד מזהה markers בתגובות ה-AI:
- `[TRIGGER:LOGO_UPLOAD]` → מציג widget להעלאת לוגו
- `[TRIGGER:COLOR_PICKER]` → מציג widget לבחירת צבעים
- `[BRIEF_CONFIRMED]` → מפעיל חילוץ בריף ויצירת וידאו

### Chat API Flow:
1. POST `/api/chat` עם `{ conversationId, message }`
2. שמירת הודעת המשתמש ב-DB
3. טעינת היסטוריית שיחה
4. קריאה ל-OpenRouter עם streaming
5. החזרת SSE stream לקליינט (token by token)
6. שמירת תגובה מלאה ב-DB בסיום
7. זיהוי triggers ושליחת events מתאימים

---

## Pipeline יצירת וידאו

```
בריף מאושר
    ↓
1. חילוץ בריף מובנה (OpenRouter + JSON response_format)
    ↓
2. יצירת prompt באנגלית ל-Runway (OpenRouter)
    ↓
3. שליחה ל-Runway ML API
   • עם לוגו → imageToVideo (gen4_turbo)
   • בלי לוגו → textToVideo (veo3.1)
    ↓
4. שמירת runwayTaskId ב-DB
    ↓
5. Polling כל 5 שניות (SSE → לקליינט)
   • PENDING → ממתין בתור
   • RUNNING → מייצר סרטון
   • SUCCEEDED → שמירת videoUrl
   • FAILED → שמירת שגיאה
    ↓
6. הצגת הסרטון / הורדה
```

---

## מערכת Auth

- **Auth.js v5** עם Prisma Adapter
- **Providers**: Email/Password (Credentials) + Google OAuth
- **Sessions**: JWT strategy
- **Middleware**: הגנה על routes של dashboard
- **Registration**: route נפרד `POST /api/auth/register` עם bcrypt hashing

---

## חבילות NPM

### Core
`next`, `react`, `react-dom`, `typescript`

### UI
`tailwindcss`, `@tailwindcss/postcss`, shadcn/ui (CLI), `lucide-react`, `sonner`, `next-themes`

### Auth
`next-auth@beta`, `@auth/prisma-adapter`, `bcryptjs`

### DB
`prisma`, `@prisma/client`

### AI & Video
`openai` (עם baseURL של OpenRouter), `@runwayml/sdk`

### Upload
`uploadthing`, `@uploadthing/react`

### Forms & Validation
`react-hook-form`, `@hookform/resolvers`, `zod`

### State
`zustand`

---

## סדר ביצוע

### שלב 1 — תשתית
- [ ] Init Next.js project (TypeScript, Tailwind, App Router)
- [ ] הגדרת RTL + פונט עברי (Heebo)
- [ ] התקנת shadcn/ui + קומפוננטות בסיס
- [ ] Prisma + PostgreSQL — schema + migration
- [ ] קובץ `.env.local`

### שלב 2 — Authentication
- [ ] Auth.js v5 config (Credentials + Google)
- [ ] דפי Login/Register
- [ ] Middleware להגנת routes
- [ ] Layout: Header + Sidebar + Mobile nav

### שלב 3 — Chat + OpenRouter
- [ ] OpenRouter client + system prompt
- [ ] API routes: conversations, chat (streaming)
- [ ] Chat UI: container, messages, input, typing indicator
- [ ] `use-chat` hook עם SSE streaming
- [ ] דף `/create` — ממשק צ'אט מלא

### שלב 4 — Upload + Widgets
- [ ] UploadThing setup
- [ ] Logo upload widget בתוך הצ'אט
- [ ] Color picker widget
- [ ] Brief summary card + אישור

### שלב 5 — Video Generation
- [ ] Brief extraction (OpenRouter → JSON)
- [ ] Runway ML client + video prompt generation
- [ ] Video generation API + status SSE polling
- [ ] Generation progress UI
- [ ] Video player + download

### שלב 6 — Dashboard + Gallery
- [ ] דף Dashboard — סקירה כללית
- [ ] גלריית סרטונים + כרטיסי וידאו
- [ ] דף פרטי סרטון + נגן
- [ ] ספריית בריפים
- [ ] דף הגדרות משתמש

### שלב 7 — ליטוש
- [ ] Error handling + הודעות שגיאה בעברית
- [ ] Loading states + Skeletons
- [ ] Responsive mobile
- [ ] SEO + metadata

---

## אימות (Verification)
1. הרצת `npm run dev` — האתר עולה ללא שגיאות
2. הרשמה + התחברות עובדים
3. יצירת שיחה חדשה — AI עונה בעברית
4. מעבר על כל 9 שלבי השיחה
5. העלאת לוגו עובדת
6. בחירת צבעים עובדת
7. אישור בריף → יצירת סרטון מתחילה
8. קבלת סרטון + הורדה
9. גלריית סרטונים מציגה היסטוריה
10. בדיקת responsive על מובייל
