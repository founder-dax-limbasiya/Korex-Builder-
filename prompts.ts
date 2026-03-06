export const TEMPLATES: Record<string, { label: string; icon: string; color: string; default: string }> = {
  saas:      { label: 'SaaS Dashboard', icon: '⬡', color: '#6366f1', default: 'SaaS analytics dashboard with KPI cards, charts, user management, billing section, and sidebar navigation.' },
  ecommerce: { label: 'E-Commerce',     icon: '◎', color: '#06b6d4', default: 'E-commerce store with product grid, search/filter, cart drawer, checkout flow, and order history.' },
  portfolio: { label: 'Portfolio',      icon: '◈', color: '#10b981', default: 'Developer portfolio with hero, projects showcase, skills, timeline, and contact form.' },
  crm:       { label: 'CRM System',     icon: '◇', color: '#f59e0b', default: 'CRM with contacts, Kanban pipeline, activity feed, company profiles, and revenue analytics.' },
  blog:      { label: 'Blog Platform',  icon: '✦', color: '#ec4899', default: 'Blog platform with post listing, editor, categories, comments, author profiles, newsletter.' },
  landing:   { label: 'Landing Page',   icon: '▲', color: '#8b5cf6', default: 'High-converting SaaS landing page with hero, features, pricing, testimonials, and FAQ.' },
  social:    { label: 'Social App',     icon: '◑', color: '#ef4444', default: 'Social app with post feed, user profiles, follow system, notifications, and messaging.' },
  custom:    { label: 'Custom Build',   icon: '⬟', color: '#a1a1aa', default: '' },
};

export const TIERS: Record<string, { label: string; files: string[]; badge?: string }> = {
  basic:      { label: 'Basic',      files: ['page.tsx'] },
  pro:        { label: 'Pro',        files: ['page.tsx', 'API route', 'SQL schema'], badge: 'POPULAR' },
  enterprise: { label: 'Enterprise', files: ['Frontend', 'API', 'DB', 'Auth', 'Vercel', 'README'], badge: 'FULL' },
};

export function buildSystemPrompt(tier: string): string {
  const scope: Record<string, string> = {
    basic: 'Generate ONE file: app/page.tsx — complete React + Tailwind frontend.',
    pro: `Generate THREE files:
1. app/page.tsx — Complete React + Tailwind frontend
2. app/api/route.ts — Full CRUD API (GET, POST, PUT, DELETE)
3. database/schema.sql — Supabase PostgreSQL schema with RLS policies`,
    enterprise: `Generate SIX files:
1. app/page.tsx — Full React frontend
2. app/api/route.ts — Complete CRUD API routes
3. app/api/auth/route.ts — Supabase Auth integration
4. database/schema.sql — Full schema with RLS, triggers, indexes, seed data
5. vercel.json — Deployment configuration
6. README.md — Non-developer setup guide`,
  };

  return `You are KODEX — an elite full-stack engineer. You write complete, beautiful, production-ready Next.js 14 + TypeScript + Tailwind CSS + Supabase code.

RULES:
- NEVER truncate. Every file must be 100% complete.
- NEVER write "// add your code here" placeholders.
- Include realistic placeholder data so UI looks populated.
- Use dark theme, modern design, mobile-first.
- Well commented TypeScript code.

${scope[tier] || scope.pro}

OUTPUT: Return ONLY valid JSON. No markdown. No extra text. Structure:
{
  "files": [{"filename":"string","language":"string","description":"string","code":"string"}],
  "summary": "2-3 sentences of what was built",
  "features": ["feature 1","feature 2","feature 3","feature 4","feature 5"],
  "setup_steps": ["Step 1: ...","Step 2: ...","Step 3: ..."],
  "env_vars": ["VAR_NAME"]
}`;
}

export function buildUserPrompt(template: string, tier: string, description: string): string {
  const t = TEMPLATES[template];
  const desc = description.trim() || t?.default || `A beautiful ${template} application`;
  return `Build a ${tier.toUpperCase()} tier ${t?.label ?? template} application.

Requirements: ${desc}

Additional:
- Deploy target: Vercel (free)
- Database: Supabase (free)
- Professional, polished UI
- Loading states, error states, empty states
- Mobile-first responsive

Generate complete output now.`;
}

export function parseResponse(raw: string, template: string) {
  try {
    const clean = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
    return JSON.parse(clean);
  } catch {}
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return {
    files: [{ filename: 'app/page.tsx', language: 'typescript', description: 'Generated app', code: raw }],
    summary: `Your ${template} app was generated.`,
    features: ['React', 'TypeScript', 'Tailwind CSS'],
    setup_steps: ['Copy code to your Next.js project', 'Run npm install', 'Run npm run dev'],
    env_vars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  };
}
