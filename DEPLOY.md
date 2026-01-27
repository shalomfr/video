# 🚀 Deploy to Render + GitHub

## Prerequisites
- GitHub account
- Render account (free tier available)

---

## 📦 Part 1: Push to GitHub

### 1. Initialize Git (if not already)
```bash
cd "c:\cursor project\video"
git init
git add .
git commit -m "Initial commit: VideoAI - AI-powered video creation platform"
```

### 2. Create GitHub Repository
1. Go to [https://github.com/new](https://github.com/new)
2. Repository name: `video-ai`
3. Keep it **Public** or **Private** (your choice)
4. **DO NOT** initialize with README (we already have one)
5. Click "Create repository"

### 3. Push to GitHub
```bash
git remote add origin https://github.com/shalomfr/video-ai.git
git branch -M main
git push -u origin main
```

---

## 🌐 Part 2: Deploy to Render

### Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Settings:
   - **Name**: `video-ai-db`
   - **Database**: `video_creator`
   - **User**: `video_user` (or keep default)
   - **Region**: Choose closest to you
   - **Plan**: **Free** (0.1GB storage)
4. Click **"Create Database"**
5. Wait ~2 minutes for it to provision
6. **Copy the "Internal Database URL"** (starts with `postgresql://`)

### Step 2: Deploy Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `shalomfr/video-ai`
3. Settings:
   - **Name**: `video-ai`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: leave empty
   - **Runtime**: `Node`
   - **Build Command**: 
     ```
     npm install && npx prisma generate && npx prisma migrate deploy && npm run build
     ```
   - **Start Command**: 
     ```
     npm run start
     ```
   - **Plan**: **Free** (512MB RAM, sleep after 15min inactivity)

4. **Environment Variables** - Add these:
   
   Click **"Advanced"** → **"Add Environment Variable"**:
   
   ```
   DATABASE_URL = [paste Internal Database URL from Step 1]
   
   NEXTAUTH_URL = https://video-ai.onrender.com
   (or your actual Render URL)
   
   NEXTAUTH_SECRET = [generate: openssl rand -base64 32]
   
   OPENROUTER_API_KEY = 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
   
   RUNWAYML_API_SECRET = [your Runway ML API key]
   
   UPLOADTHING_TOKEN = [your UploadThing token]
   ```

5. Click **"Create Web Service"**

### Step 3: Wait for Deployment
- First deploy takes ~5-10 minutes
- Watch the logs for any errors
- Once you see "✓ Compiled successfully", it's ready!

### Step 4: Run Database Migrations
The build command already includes `prisma migrate deploy`, so migrations run automatically on each deployment.

---

## ✅ Verify Deployment

1. Open your Render URL: `https://video-ai.onrender.com`
2. You should see the landing page
3. Try registering a new user
4. Try creating a video (if you have Runway API key)

---

## 🔧 Troubleshooting

### Build Fails
- Check the build logs in Render dashboard
- Common issues:
  - Missing environment variables
  - Database connection string incorrect
  - Prisma migration errors

### Database Connection Errors
- Make sure you're using the **Internal Database URL** (not External)
- Format: `postgresql://user:password@host/database?sslmode=require`

### App Crashes After Deploy
- Check the logs: **Dashboard → Your Service → Logs**
- Verify all environment variables are set
- Make sure `DATABASE_URL` has `?sslmode=require` at the end

### Free Tier Limitations
- **Web Service**: Sleeps after 15 minutes of inactivity (50ms cold start)
- **Database**: 0.1GB storage, 90-day expiry if inactive
- **Bandwidth**: 100GB/month

---

## 🔄 Updating the App

After making changes locally:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

Render will automatically detect the push and redeploy! 🎉

---

## 🔐 Security Notes

1. **Never commit `.env.local`** (it's in .gitignore)
2. **Rotate your API keys** if they're ever exposed
3. Use Render's environment variables for secrets
4. Enable **Auto-Deploy** for automatic updates from GitHub

---

## 💰 Cost Estimate

**Free Tier (what you have now):**
- PostgreSQL: $0/month (90-day inactive limit)
- Web Service: $0/month (sleeps after 15min)
- **Total: $0/month**

**If you need always-on:**
- PostgreSQL: $7/month (1GB)
- Web Service: $7/month (always-on, 512MB)
- **Total: $14/month**

---

## 📚 Useful Links

- [Render Docs](https://render.com/docs)
- [Next.js on Render](https://render.com/docs/deploy-nextjs)
- [Prisma with Render](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-render)

---

**Created by Claude Code** 🤖
