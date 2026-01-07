# Railway Deployment Lessons Learned

**Date:** January 7, 2026
**Project:** NFL Playoff Predictor (React + Express + SQLite)
**Platform:** Railway.app

---

## Critical Issue: Express Middleware Order

### THE PROBLEM
Static files were returning 500 errors with MIME type 'text/html' instead of the actual JS/CSS files.

### ROOT CAUSE
**CORS middleware was running BEFORE static file middleware**, causing all static file requests to be blocked with "Not allowed by CORS" errors.

### THE SOLUTION
```typescript
// ❌ WRONG - Static files after CORS
app.use(cors({ ... }));
app.use(express.static(clientPath));  // Too late! CORS already blocked it

// ✅ CORRECT - Static files BEFORE CORS
app.use(express.static(clientPath));  // Serve static files first
app.use(cors({ ... }));                // Then check CORS for API routes
```

### Key Insight
Static files (JS, CSS, images) should **NEVER** go through CORS middleware. They need to be served directly by Express static file handler BEFORE any other middleware that might reject the request.

---

## Complete Middleware Order for Express + React SPA

```typescript
// 1. INITIALIZE DATABASE
initializeDatabase();

// 2. SERVE STATIC FILES FIRST (in production)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));
}

// 3. CORS (only for API routes now)
app.use(cors({ ... }));

// 4. BODY PARSERS
app.use(express.json());

// 5. SESSION MIDDLEWARE
app.use(session({ ... }));

// 6. API ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/lobby', lobbyRoutes);
// ... more API routes

// 7. SPA FALLBACK (MUST BE LAST!)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}
```

---

## Railway Monorepo Build Configuration

### Project Structure
```
project-root/
├── package.json          # Root scripts
├── railway.json          # Railway config
├── build.sh             # Custom build script
├── client/
│   ├── package.json
│   ├── src/
│   └── dist/            # Built files (gitignored)
└── server/
    ├── package.json
    ├── src/
    └── dist/            # Built files (gitignored)
```

### Root package.json
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "build": "cd client && npm run build && cd ../server && npm run build",
    "start": "npm run start --prefix server",
    "postinstall": "npm install --prefix server && npm install --prefix client"
  }
}
```

**Critical:** The `postinstall` script ensures Railway installs dependencies in BOTH subdirectories.

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && bash build.sh"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### build.sh
```bash
#!/bin/bash
set -ex

echo "========================================"
echo "Building client..."
echo "========================================"
cd client
npm run build
echo "Client dist contents: $(ls -la dist/)"
cd ..

echo "========================================"
echo "Building server..."
echo "========================================"
cd server
npm run build
echo "Server dist contents: $(ls -la dist/)"
cd ..

echo "Build complete!"
```

**Why a custom build script?**
- Railway's `--prefix` flag doesn't work reliably in Docker
- Explicit `cd` commands ensure correct build directory
- Verbose logging helps debug build issues

---

## Environment Variables for Production

### Required Variables
```bash
NODE_ENV=production
SESSION_SECRET=<64-char-hex-string>  # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
FRONTEND_URL=https://your-actual-railway-url.railway.app
```

### Environment-Aware CORS
```typescript
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL || 'https://your-app.railway.app']
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

---

## Common Deployment Issues & Solutions

### Issue 1: Blank Page / 500 Errors on Assets
**Symptoms:**
- Browser shows blank page
- Console shows `net::ERR_ABORTED 500` for `/assets/*.js` and `/assets/*.css`
- MIME type errors: `'text/html'` instead of `application/javascript`

**Diagnosis:**
```bash
# Check if assets load via curl (bypasses CORS)
curl -I https://your-app.railway.app/assets/index-xxx.js

# If curl returns 200 OK but browser gets 500, it's CORS blocking
```

**Solution:**
Move `express.static()` BEFORE `cors()` middleware.

---

### Issue 2: TypeScript Build Failures
**Symptoms:**
- Build fails with errors in test files
- Production build shouldn't include tests

**Solution:**
Update `server/tsconfig.json`:
```json
{
  "exclude": [
    "node_modules",
    "src/**/*.test.ts",
    "src/__tests__/**/*",
    "src/test-utils/**/*"
  ]
}
```

Install missing type definitions:
```bash
npm install --save-dev @types/sql.js  # Or whatever types are missing
```

---

### Issue 3: Client Build Not Running
**Symptoms:**
- Server builds but client doesn't
- `client/dist/` directory doesn't exist on Railway
- Logs only show server TypeScript compilation

**Diagnosis:**
Check build logs for:
- "Building client..." message
- Vite build output
- "Files in client/dist: [ 'assets', 'index.html' ]"

If missing, the build script isn't running correctly.

**Solution:**
- Use explicit `cd` commands instead of `--prefix`
- Ensure `build.sh` has execute permissions (git will preserve)
- Use `bash build.sh` instead of `./build.sh` in railway.json

---

### Issue 4: Railway Not Picking Up Changes
**Symptoms:**
- Code changes pushed but Railway not rebuilding
- Old code still running

**Solution:**
1. Check Railway dashboard - deployment should trigger on push
2. Force redeploy: Railway Dashboard → Deployments → Redeploy
3. Verify GitHub webhook is connected

---

### Issue 5: Session Cookies Not Persisting (401 Unauthorized on /api/auth/me)
**Symptoms:**
- Registration/login appears to succeed (200 OK)
- Immediately get 401 Unauthorized on `/api/auth/me`
- User can't access authenticated routes
- Session cookie not being sent by browser

**Root Cause:**
When serving frontend and backend from the **same domain** in production (e.g., both from Railway URL), you have **same-origin** requests, not cross-origin. CORS middleware can interfere with session cookies.

**Diagnosis:**
Check browser DevTools:
- Application/Storage tab → Cookies → Check if session cookie exists
- Network tab → Check if `Cookie` header is sent with requests
- Console → Look for CORS errors on API requests

**Solution:**
```typescript
// ❌ WRONG - CORS enabled in production for same-origin setup
app.use(cors({ ... }));  // Blocks all requests including same-origin!

// ✅ CORRECT - Only enable CORS in development
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  }));
}

// ✅ CORRECT - Session cookie configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    sameSite: 'lax',  // 'lax' for same-origin, 'none' only if cross-origin
    maxAge: 1000 * 60 * 60 * 24 * 7,  // 7 days
  },
}));
```

**Key Insight:**
- **Development**: Frontend (localhost:5173) → Backend (localhost:3001) = **Cross-origin** → CORS needed
- **Production (Railway)**: Frontend & Backend both on same domain → **Same-origin** → CORS NOT needed
- Using `sameSite: 'none'` requires `secure: true` and is meant for cross-site cookies (like embedded iframes)
- For same-origin apps, use `sameSite: 'lax'` which provides CSRF protection while allowing cookies

**Warning:**
If you later decide to serve frontend from a CDN or different domain, you'll need to:
1. Re-enable CORS in production with the frontend domain in allowed origins
2. Change `sameSite: 'none'` (requires HTTPS)
3. Ensure `credentials: true` in both CORS config and fetch requests

---

## Railway CLI Setup

### Installation
```bash
npm install -g @railway/cli
```

### Initial Setup
```bash
railway login          # Opens browser for auth
cd /path/to/project
railway link           # Select your project from menu
```

### Useful Commands
```bash
railway logs           # Stream real-time logs
railway logs --deployment  # Logs from specific deployment
railway status         # Check deployment status
railway up             # Deploy directly from CLI
railway open           # Open Railway dashboard
railway variables      # List environment variables
```

### Pro Tip
Run `railway logs` in a separate terminal while developing to see deployment logs in real-time without switching to the browser.

---

## Production Checklist

### Before First Deploy
- [ ] Git repository initialized and pushed to GitHub
- [ ] `.gitignore` includes: `node_modules/`, `dist/`, `*.db`, `.env`
- [ ] Root `package.json` has `postinstall` script
- [ ] `railway.json` configured with custom build
- [ ] `build.sh` created and tested locally
- [ ] Environment variables documented

### Railway Configuration
- [ ] Project created and linked to GitHub repo
- [ ] Builder set to **Nixpacks** (not Railpack)
- [ ] Build Command: `npm install && bash build.sh`
- [ ] Start Command: `npm start`
- [ ] Root Directory: `/` (or empty)

### Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `SESSION_SECRET=<secure-random-string>`
- [ ] Generate Railway domain
- [ ] `FRONTEND_URL=<actual-railway-url>` (add after first deploy)

### Code Verification
- [ ] Static files served BEFORE CORS
- [ ] CORS allows production URL
- [ ] Session secret validation in production
- [ ] SPA fallback route is LAST
- [ ] TypeScript excludes test files

### Post-Deploy Testing
- [ ] Visit Railway URL - page loads
- [ ] Hard refresh (Ctrl+F5) - no errors
- [ ] Check browser console - no CORS errors
- [ ] Test API endpoints
- [ ] Test user registration/login
- [ ] Verify database persistence

---

## Debugging Techniques

### 1. Check Build Logs
Look for these key indicators:
```bash
# Good signs:
✓ built in 1.05s
Build complete!
Files in client/dist: [ 'assets', 'index.html' ]
Files in client/dist/assets: [ 'index-BxNxYOlI.css', 'index-DovUtnDs.js' ]

# Bad signs:
Error: Cannot find module
tsc: error TS2307
npm ERR!
```

### 2. Check Deploy Logs
Look for:
```bash
# Good signs:
Setting up static file serving from: /app/client/dist
Server running on http://localhost:3001

# Bad signs:
Error: Not allowed by CORS
clientPath exists: false
Error sending index.html
```

### 3. Test with curl
```bash
# Test asset loading (bypasses browser CORS)
curl -I https://your-app.railway.app/assets/index-xxx.js
# Should return: HTTP/1.1 200 OK
#                Content-Type: application/javascript

# Test HTML
curl https://your-app.railway.app/
# Should return: <!doctype html> with script tags

# Test API health
curl https://your-app.railway.app/api/health
# Should return: {"status":"ok"}
```

### 4. Browser DevTools
**Network Tab:**
- Filter by "JS" - all should be 200, not 500
- Check Response Headers - should see `Content-Type: application/javascript`
- If seeing `Content-Type: text/html`, assets are being intercepted

**Console Tab:**
- Look for CORS errors (red text mentioning origin)
- Look for MIME type errors
- Look for 404s (file not found) vs 500s (server error)

---

## Cost & Resource Management

### Railway Pricing (as of Jan 2026)
- **Hobby Plan:** $5/month
- Includes: 512MB RAM, 1GB storage, reasonable CPU
- Sufficient for: Small apps, personal projects, MVP testing

### SQLite Persistence
**Critical:** Enable Railway **Volumes** to persist SQLite database across deploys.

**Setup:**
1. Railway Dashboard → Service → Storage
2. Add Volume
3. Mount path: `/app` (where database.db is created)
4. Size: 1GB (minimum)

**Without volumes:** Database resets on every deploy!

---

## Key Takeaways

### What Worked Well
1. **Nixpacks builder** - Reliable for Node.js monorepos
2. **Custom build script** - More control than package.json scripts
3. **Explicit middleware ordering** - Prevents subtle bugs
4. **Railway CLI** - Faster feedback loop than web dashboard
5. **Environment-aware config** - Same code works dev and prod

### What Didn't Work
1. **Railpack builder** - Too new, doesn't handle monorepos well
2. **`npm run --prefix`** - Unreliable in Docker containers
3. **CORS after static files** - Blocks asset requests
4. **Implicit middleware order** - Led to hours of debugging
5. **CORS enabled in production for same-origin** - Broke session cookies and caused 401 errors
6. **Wrong sameSite cookie setting** - Using 'none' when 'lax' is correct for same-origin

### Time Savers for Next Time
1. Set up middleware order correctly from the start
2. Use `railway.json` with custom build script immediately
3. Test with curl to isolate CORS vs file issues
4. Install Railway CLI before starting
5. **Understand same-origin vs cross-origin** - Don't enable CORS in production if frontend/backend on same domain
6. **Start with correct session cookie config** - Use `sameSite: 'lax'` for same-origin, `secure: true` for HTTPS
7. Reference this document! 🎯

---

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Nixpacks Documentation](https://nixpacks.com)
- [Express Middleware Order](https://expressjs.com/en/guide/using-middleware.html)
- [CORS Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- Deployment Plan: `.claude/plans/pure-singing-grove.md`

---

## Version History

- **v1.0** (2026-01-07): Initial deployment, identified CORS middleware ordering issue
  - Deployment completed successfully after moving static file serving before CORS
- **v1.1** (2026-01-07): Fixed session cookie persistence in production
  - Issue: 401 Unauthorized errors on `/api/auth/me` after login/registration
  - Root cause: CORS enabled in production for same-origin setup
  - Solution: Disabled CORS in production (only needed for dev), set `sameSite: 'lax'`

---

## Final Notes

### Critical Lessons Learned

**1. Middleware order matters in Express!**

Static files must be served BEFORE CORS middleware, otherwise browsers will get CORS errors when trying to load JS/CSS assets, even though the files exist and curl can fetch them.

**2. Understand same-origin vs cross-origin for CORS and cookies!**

- **Same-origin**: Frontend and backend on same domain → No CORS needed → Use `sameSite: 'lax'`
- **Cross-origin**: Frontend and backend on different domains → CORS required → Use `sameSite: 'none'` + `secure: true`

In this project:
- **Development**: `localhost:5173` (frontend) → `localhost:3001` (backend) = Cross-origin
- **Production**: Both on Railway URL = Same-origin

**3. Systematic debugging is essential**

Both major issues required methodical debugging:
1. curl showed files loading correctly (bypasses CORS)
2. Server logs showed files existed
3. Browser DevTools revealed the actual errors
4. Railway logs confirmed the server-side behavior

The fixes were simple once identified (move one line, disable CORS in prod), but finding the root cause required systematic investigation.

**For future deployments:**
- Start with correct middleware order
- Understand your deployment architecture (same-origin vs cross-origin)
- Set up session cookies correctly from the start
- Save yourself hours of pain! 💡
