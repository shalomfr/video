# 🚀 Deploy to Vercel (Alternative to Render)

## Why Vercel?
- ✅ No credit card required for Free tier
- ✅ Auto-deploys from GitHub
- ✅ Built-in PostgreSQL (Vercel Postgres)
- ✅ Simpler setup
- ✅ Better Next.js optimization

---

## Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

Or deploy via web (easier):

---

## Step 2: Deploy via Web

1. Go to: https://vercel.com/new
2. **Import Git Repository** → Connect GitHub → Select `shalomfr/video-ai`
3. **Configure Project**:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (leave default)
   - Build Command: `npm run build` (auto)
   - Output Directory: `.next` (auto)

4. **Environment Variables** - Add these:
   ```env
   NEXTAUTH_URL = https://video-ai.vercel.app
   NEXTAUTH_SECRET = 2nUX8XUUolE/sxRxzYa9VxutMUksIG9GKeoXpqKOTCg=
   OPENROUTER_API_KEY = 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
   RUNWAYML_API_SECRET = (leave empty for now)
   UPLOADTHING_TOKEN = (leave empty for now)
   ```

5. **DATABASE_URL** - We'll add this after creating the database

6. Click **Deploy**

---

## Step 3: Add Vercel Postgres Database

1. After deploy, go to your project dashboard
2. Click **Storage** tab → **Create Database**
3. Select **Postgres** → **Continue**
4. Name: `video-creator-db`
5. Region: Choose closest to you
6. Click **Create**

7. **Connect Database**:
   - You'll see environment variables automatically added
   - `POSTGRES_URL` will be set
   - We need to rename it to `DATABASE_URL`

8. Go to **Settings** → **Environment Variables**:
   - Find `POSTGRES_URL`
   - Copy its value
   - Add new variable: `DATABASE_URL` = [paste the POSTGRES_URL value]
   - Click **Save**

---

## Step 4: Run Database Migrations

After DATABASE_URL is added, you need to run migrations:

### Option A: Via Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
vercel link

# Pull environment variables
vercel env pull .env.local

# Run migrations
npx prisma migrate deploy
npx prisma generate
```

### Option B: Add to Build Command

Go to **Settings** → **General** → **Build & Development Settings**

Change **Build Command** to:
```bash
npx prisma generate && npx prisma migrate deploy && next build
```

Then redeploy:
- **Deployments** → click **...** → **Redeploy**

---

## Step 5: Verify

Your app will be live at: `https://video-ai.vercel.app`

Test:
1. Open the URL
2. Register a new user
3. Try the chat interface

---

## 🔄 Auto-Deploy

Vercel automatically deploys on every push to `main`:

```bash
git add .
git commit -m "Update"
git push origin main
```

Vercel will auto-deploy! ✨

---

## 💰 Cost

**Free Tier:**
- Unlimited deployments
- 100 GB bandwidth/month
- Vercel Postgres: 256 MB storage (upgradable)
- Serverless Functions: 100 GB-hours

**More than enough for development and small projects!**

---

## 🆚 Vercel vs Render

| Feature | Vercel | Render |
|---------|--------|--------|
| Free Tier | ✅ No CC | ⚠️ CC Required |
| Auto-Deploy | ✅ | ✅ |
| Next.js Optimization | ✅✅✅ | ✅ |
| Setup Complexity | ⭐⭐ | ⭐⭐⭐⭐ |
| Cold Start | ~50ms | ~500ms |
| Database | Postgres included | Separate service |

---

**Vercel is the recommended choice for Next.js apps!**
