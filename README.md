# KODEX Builder 🔮

## Deploy in 10 Minutes (Phone-Friendly!)

### Step 1 — Supabase Database
1. supabase.com → your project → SQL Editor → New Query
2. Paste entire contents of `database.sql` → Run
3. You'll see: `KODEX database ready! ✓`

### Step 2 — Upload to GitHub
1. github.com → New repository → "kodex-builder"
2. Upload all files from this ZIP

### Step 3 — Deploy on Vercel
1. vercel.com → New Project → Import GitHub repo
2. Add these Environment Variables:

```
GROQ_API_KEY          = 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
GROQ_MODEL            = deepseek-r1-distill-llama-70b
GROQ_FALLBACK         = llama-3.1-70b-versatile
GROQ_EMERGENCY        = llama3-8b-8192
NEXT_PUBLIC_SUPABASE_URL      = https://ofstrbniovqdzautdbqr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_SsxyLIc5OBQ9b6x4xVknlA_TsInq6hK
SUPABASE_SERVICE_ROLE_KEY     = sb_secret_O6sbWGL1v0lThKUNZSPMfA_LtXURK5V
NEXT_PUBLIC_APP_URL   = https://your-app.vercel.app
RATE_LIMIT_PER_HOUR   = 15
MAX_TOKENS            = 7000
```

3. Click Deploy → Done! 🎉

### After Deploy
- Update NEXT_PUBLIC_APP_URL with your real Vercel URL
- In Supabase → Authentication → URL Configuration → add your Vercel URL
- ⚠️ Rotate your API keys (they were shared in chat)

### Enable Google Login (Optional)
1. Supabase → Authentication → Providers → Google → Enable
2. Get OAuth credentials from console.cloud.google.com
3. Add Client ID + Secret to Supabase
