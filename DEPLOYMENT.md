# Vercel Deployment Guide

## Prerequisites
- GitHub account with your repository
- Vercel account (free or paid)

## Deployment Steps

### 1. Connect GitHub Repository to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Select your GitHub repository (VigneshSivaKspm/secure_online_examination)
4. Click "Import"

### 2. Configure Environment Variables
**Important**: Set environment variables directly in Vercel Dashboard, NOT in code.

**Steps:**
1. Go to your Vercel Project Dashboard
2. Click **Settings** → **Environment Variables**
3. Click **Add New** and enter each variable:

| Variable | Value |
|----------|-------|
| `VITE_FIREBASE_API_KEY` | Your API Key from Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | Your Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | your-bucket.appspot.com |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your Sender ID |
| `VITE_FIREBASE_APP_ID` | Your App ID |

4. Click **Save**
5. Redeploy your project (push to GitHub or click "Redeploy" in Vercel)

**How to find Firebase credentials:**
- Go to [Firebase Console](https://console.firebase.google.com)
- Select your project
- Click ⚙️ → **Project Settings**
- Scroll to "Your apps" section
- Click on your web app
- Copy all values under "Firebase SDK snippet"

### 3. Auto Deploy
- Vercel automatically deploys on every push to `main` branch
- Pull requests get preview deployments
- No additional setup needed!

## File Configuration Details

### vercel.json
- **buildCommand**: Uses `npm run build` (Vite will create dist folder)
- **outputDirectory**: Points to `dist` (Vite's output)
- **rewrites**: Routes all requests to `/index.html` (fixes 404 on direct route access)
- **env**: Environment variable configuration

### vite.config.ts Updates
- **outDir**: Ensures build outputs to `dist`
- **sourcemap**: Disabled in production for faster builds
- **manualChunks**: Splits code into vendor chunks for better caching
- **historyApiFallback**: Development server will serve index.html for any unmatched route

## Testing Locally Before Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Preview production build:
   ```bash
   npm run preview
   ```

3. Test direct route access (should work without 404):
   - http://localhost:4173/login
   - http://localhost:4173/admin-dashboard
   - http://localhost:4173/student-dashboard

## Troubleshooting

### 404 Errors on Direct Routes
✅ **FIXED** - `vercel.json` rewrites all routes to index.html

### Environment Variables Not Loading
- Check Project Settings in Vercel Dashboard
- Ensure variables start with `VITE_` (required by Vite)
- Redeploy after adding/updating environment variables

### Build Fails
- Check build logs in Vercel Dashboard
- Ensure `npm run build` works locally: `npm run build`
- Verify all TypeScript errors are fixed: `npx tsc --noEmit`

## Production URL
Once deployed, your app will be available at:
- https://your-project-name.vercel.app (auto assigned)
- Custom domain (if configured in Vercel settings)

## Continuous Deployment
Every git push to `main` will automatically trigger deployment. Monitor deployments in Vercel Dashboard.
