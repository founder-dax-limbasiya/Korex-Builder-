'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase.client';
import { TEMPLATES, TIERS } from '@/lib/prompts';
import type { User } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────
type View = 'home' | 'generating' | 'output' | 'history';
type AuthMode = 'login' | 'signup';
interface KFile { filename: string; language: string; description: string; code: string; }
interface Result { files: KFile[]; summary: string; features: string[]; setup_steps: string[]; env_vars: string[]; _meta?: Record<string, unknown>; }
interface Project { id: string; template_id: string; tier_id: string; description: string; model_used: string; tokens_used: number; created_at: string; result?: Result; }

// ─── Constants ────────────────────────────────────────────────
const PHASES = [
  'Spinning up KODEX engine…', 'Parsing your requirements…', 'Designing architecture…',
  'Scaffolding components…', 'Writing frontend code…', 'Building API routes…',
  'Generating database schema…', 'Adding TypeScript types…', 'Optimizing for production…', 'Finalizing your app…',
];
const PCTS = [6, 15, 25, 36, 50, 63, 75, 84, 92, 98];
const CHIPS = [
  '🛒 E-commerce with Stripe checkout', '📊 SaaS analytics dashboard',
  '👤 Developer portfolio site', '💬 Social platform with feed',
  '🏢 CRM with Kanban pipeline', '📝 Blog with CMS & SEO',
  '📱 Mobile-first landing page', '🤖 AI chatbot interface',
];

// ─── Toast ────────────────────────────────────────────────────
let _toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
  const el = document.getElementById('_toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.borderColor = type === 'error' ? 'rgba(239,68,68,.5)' : type === 'success' ? 'rgba(16,185,129,.5)' : 'rgba(255,255,255,.12)';
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ─── Background ───────────────────────────────────────────────
function Background() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,.15) 0%,transparent 70%)', top: -200, right: -100, filter: 'blur(40px)', animation: 'orb1 20s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(6,182,212,.1) 0%,transparent 70%)', bottom: -150, left: -100, filter: 'blur(40px)', animation: 'orb2 25s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg,transparent,rgba(99,102,241,.4),transparent)', animation: 'scanLine 8s linear infinite' }} />
    </div>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────
function AuthModal({ onClose, onAuth }: { onClose: () => void; onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'email' | 'phone'>('email');
  const sb = createClient();

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error) throw error;
        if (data.user) { showToast('✅ Account created!', 'success'); onAuth(data.user); onClose(); }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('✅ Welcome back!', 'success'); onAuth(data.user); onClose();
      }
    } catch (err: unknown) { showToast('❌ ' + (err instanceof Error ? err.message : 'Auth failed'), 'error'); }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/api/auth/callback` } });
    if (error) showToast('❌ ' + error.message, 'error');
  };

  const handleGithub = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${window.location.origin}/api/auth/callback` } });
    if (error) showToast('❌ ' + error.message, 'error');
  };

  const sendOtp = async () => {
    if (!phone) return showToast('Enter phone number', 'error');
    const { error } = await sb.auth.signInWithOtp({ phone });
    if (error) return showToast('❌ ' + error.message, 'error');
    setOtpSent(true); showToast('📱 OTP sent!', 'success');
  };

  const verifyOtp = async () => {
    const { data, error } = await sb.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    if (error) return showToast('❌ ' + error.message, 'error');
    showToast('✅ Welcome to KODEX!', 'success'); onAuth(data.user!); onClose();
  };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#111114', border: '1px solid rgba(255,255,255,.12)', borderRadius: 22, padding: '36px 32px', width: '100%', maxWidth: 420, position: 'relative', animation: 'modalIn .35s cubic-bezier(.34,1.56,.64,1)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', color: '#71717a', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'linear-gradient(135deg,#6366f1,#06b6d4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono',monospace", boxShadow: '0 0 30px rgba(99,102,241,.4)', marginBottom: 14 }}>K</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Welcome to KODEX</div>
          <div style={{ fontSize: 13, color: '#71717a', lineHeight: 1.5 }}>Sign in free to save projects & access history</div>
        </div>

        {/* OAuth */}
        {['google', 'github'].map(provider => (
          <button key={provider} onClick={provider === 'google' ? handleGoogle : handleGithub}
            style={{ width: '100%', padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: '#18181b', color: '#fafafa', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8, transition: 'all .2s', fontFamily: "'Space Grotesk',sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,.4)'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.1)'; (e.currentTarget as HTMLElement).style.background = '#18181b'; }}>
            {provider === 'google'
              ? <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>}
            Continue with {provider.charAt(0).toUpperCase() + provider.slice(1)}
          </button>
        ))}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
          <span style={{ fontSize: 11, color: '#52525b' }}>or continue with</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#18181b', borderRadius: 10, padding: 3, marginBottom: 16 }}>
          {(['email', 'phone'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: tab === t ? '#09090b' : 'transparent', color: tab === t ? '#fafafa' : '#71717a', fontSize: 13, cursor: 'pointer', transition: 'all .2s', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 500 }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Email Form */}
        {tab === 'email' && (
          <form onSubmit={handleEmail}>
            {/* Auth mode tabs */}
            <div style={{ display: 'flex', background: '#18181b', borderRadius: 10, padding: 3, marginBottom: 14 }}>
              {(['login', 'signup'] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: mode === m ? '#09090b' : 'transparent', color: mode === m ? '#fafafa' : '#71717a', fontSize: 12, cursor: 'pointer', fontFamily: "'Space Grotesk',sans-serif" }}>
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
            {mode === 'signup' && <input style={inputStyle} type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />}
            <input style={inputStyle} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
            <input style={{ ...inputStyle, marginBottom: 14 }} type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
            <button type="submit" disabled={loading} style={{ ...submitStyle, opacity: loading ? .5 : 1 }}>
              {loading ? <Spinner /> : null}
              {mode === 'login' ? 'Sign In' : 'Create Free Account'}
            </button>
          </form>
        )}

        {/* Phone Form */}
        {tab === 'phone' && (
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} />
              <button onClick={sendOtp} style={{ ...submitStyle, width: 'auto', padding: '12px 16px', flexShrink: 0 }}>Send OTP</button>
            </div>
            {otpSent && (
              <>
                <input style={{ ...inputStyle, marginTop: 8 }} type="text" placeholder="6-digit OTP" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} />
                <button onClick={verifyOtp} style={submitStyle}>Verify & Sign In</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: 11, background: '#18181b', border: '1px solid rgba(255,255,255,.08)', color: '#fafafa', fontSize: 14, marginBottom: 10, transition: 'border-color .2s', fontFamily: "'Space Grotesk',sans-serif" };
const submitStyle: React.CSSProperties = { width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: "'Space Grotesk',sans-serif", boxShadow: '0 4px 16px rgba(99,102,241,.3)', transition: 'all .25s' };
const Spinner = () => <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />;

// ─── Main App ─────────────────────────────────────────────────
export default function Page() {
  const [view, setView] = useState<View>('home');
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [template, setTemplate] = useState('saas');
  const [tier, setTier] = useState('pro');
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState('');
  const [pct, setPct] = useState(0);
  const [logs, setLogs] = useState<{ msg: string; type: string }[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [activeFile, setActiveFile] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [copiedFile, setCopiedFile] = useState(false);
  const [error, setError] = useState('');
  const phaseRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const sb = createClient();

  // Auth init
  useEffect(() => {
    sb.auth.getUser().then(({ data: { user } }) => { if (user) { setUser(user); loadProjects(user.id); } });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProjects(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProjects = async (uid: string) => {
    const res = await fetch('/api/history');
    if (res.ok) { const d = await res.json(); setProjects(d.generations ?? []); }
  };

  const signOut = async () => { await sb.auth.signOut(); setUser(null); setProjects([]); setShowUserMenu(false); showToast('👋 Signed out', 'success'); };

  const addLog = useCallback((msg: string, type = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }, []);

  const generate = async () => {
    if (!prompt.trim() && template === 'custom') { showToast('Describe your app first!', 'error'); return; }
    setError(''); setResult(null); setActiveFile(0); setLogs([]);
    setView('generating'); setPct(0);

    let idx = 0;
    phaseRef.current = setInterval(() => {
      if (idx < PHASES.length) { setPhase(PHASES[idx]); setPct(PCTS[idx]); addLog(PHASES[idx], 'info'); idx++; }
    }, 950);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template, tierId: tier, description: prompt }),
      });
      const data = await res.json();
      clearInterval(phaseRef.current!);

      if (!res.ok) {
        if (res.status === 429) { setError(data.error); setView('home'); return; }
        throw new Error(data.error || 'Generation failed');
      }

      setPct(100); setPhase('Complete! 🎉'); addLog('✓ App generated!', 'success');
      await new Promise(r => setTimeout(r, 600));
      setResult({ files: data.files ?? [], summary: data.summary ?? '', features: data.features ?? [], setup_steps: data.setup_steps ?? [], env_vars: data.env_vars ?? [], _meta: data._meta });
      setView('output');
      if (user) { await loadProjects(user.id); showToast('✅ Saved to history!', 'success'); }
      else showToast('✅ App generated! Sign in to save.', 'success');
    } catch (err: unknown) {
      clearInterval(phaseRef.current!);
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg); setView('home'); showToast('❌ ' + msg, 'error');
    }
  };

  const copyCode = () => {
    const f = result?.files[activeFile];
    if (!f) return;
    navigator.clipboard.writeText(f.code).then(() => { setCopiedFile(true); showToast('📋 Copied!', 'success'); setTimeout(() => setCopiedFile(false), 2000); });
  };

  const saveFile = () => {
    const f = result?.files[activeFile];
    if (!f) return;
    const blob = new Blob([f.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = f.filename.split('/').pop()!; a.click(); URL.revokeObjectURL(url);
    showToast('💾 Saved ' + f.filename.split('/').pop(), 'success');
  };

  const downloadAll = () => {
    if (!result?.files.length) return;
    result.files.forEach((f, i) => setTimeout(() => {
      const blob = new Blob([f.code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = f.filename.split('/').pop()!; a.click(); URL.revokeObjectURL(url);
    }, i * 300));
    showToast(`📦 Downloading ${result.files.length} files…`, 'success');
  };

  const deleteProject = async (id: string) => {
    await fetch('/api/history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setProjects(prev => prev.filter(p => p.id !== id));
    showToast('🗑 Deleted', 'success');
  };

  const loadProject = (p: Project) => {
    if (!p.result) return;
    setResult(p.result); setActiveFile(0); setView('output');
  };

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'U';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden}
        body{font-family:'Space Grotesk',sans-serif;background:#09090b;color:#fafafa;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#27272a;border-radius:2px}
        textarea,input{font-family:'Space Grotesk',sans-serif;outline:none}
        button{outline:none;font-family:'Space Grotesk',sans-serif}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes orb1{0%,100%{transform:translate(0,0)}33%{transform:translate(60px,-40px)}66%{transform:translate(-30px,20px)}}
        @keyframes orb2{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,30px)}}
        @keyframes scanLine{0%{top:0}100%{top:100%}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes modalIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,.4)}70%{box-shadow:0 0 0 8px rgba(99,102,241,0)}}
        @keyframes gradMove{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes shimmerBar{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes ringFast{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes ringMed{from{transform:rotate(0)}to{transform:rotate(-360deg)}}
        @keyframes codeFade{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:translateX(0)}}
      `}</style>

      <Background />

      {/* Toast */}
      <div id="_toast" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'rgba(17,17,20,.97)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '12px 22px', fontSize: 13, color: '#fafafa', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,.4)', display: 'none', whiteSpace: 'nowrap' }} />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={u => setUser(u)} />}

      {/* App shell */}
      <div style={{ position: 'relative', zIndex: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Topbar ── */}
        <header style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(9,9,11,.85)', backdropFilter: 'blur(24px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div onClick={() => setView('home')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono',monospace", boxShadow: '0 0 20px rgba(99,102,241,.4)' }}>K</div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, background: 'linear-gradient(135deg,#fff,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>KODEX</span>
              <span style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.3)', fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: '#818cf8', letterSpacing: '.08em' }}>BETA</span>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {(['home', 'history'] as View[]).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: view === v ? '#18181b' : 'transparent', color: view === v ? '#fafafa' : '#71717a', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all .2s', textTransform: 'capitalize' }}>
                  {v === 'home' ? 'Builder' : 'History'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            {user ? (
              <>
                <div onClick={() => setShowUserMenu(p => !p)} style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '2px solid rgba(99,102,241,.4)', overflow: 'hidden' }}>
                  {user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : userName[0].toUpperCase()}
                </div>
                {showUserMenu && (
                  <div style={{ position: 'absolute', top: 42, right: 0, width: 220, background: '#111114', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, padding: 8, boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 500 }}>
                    <div style={{ padding: '10px 12px 10px', borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{userName}</div>
                      <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{user.email}</div>
                    </div>
                    {[['📋 My Projects', () => { setView('history'); setShowUserMenu(false); }], ['🚪 Sign Out', signOut]].map(([label, action]) => (
                      <div key={label as string} onClick={action as () => void} style={{ padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 13, color: '#a1a1aa', transition: 'all .15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#18181b'; (e.currentTarget as HTMLElement).style.color = '#fafafa'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa'; }}>
                        {label as string}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <button onClick={() => setShowAuth(true)} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .25s', boxShadow: '0 0 20px rgba(99,102,241,.3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#818cf8'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#6366f1'; }}>
                Sign In Free
              </button>
            )}
          </div>
        </header>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Sidebar */}
          <aside style={{ width: 248, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.07)', background: 'rgba(9,9,11,.6)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#52525b', letterSpacing: '.06em', textTransform: 'uppercase' }}>Projects</span>
              <button onClick={() => setView('home')} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ New</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
              {!user ? (
                <div style={{ padding: '30px 12px', textAlign: 'center', color: '#52525b', fontSize: 12, lineHeight: 1.6 }}>
                  <div style={{ fontSize: 26, marginBottom: 10, opacity: .4 }}>📁</div>
                  Sign in to save & access your projects
                </div>
              ) : projects.length === 0 ? (
                <div style={{ padding: '30px 12px', textAlign: 'center', color: '#52525b', fontSize: 12, lineHeight: 1.6 }}>
                  <div style={{ fontSize: 26, marginBottom: 10, opacity: .4 }}>✨</div>
                  Build your first app!
                </div>
              ) : projects.map((p, i) => (
                <div key={p.id} onClick={() => loadProject(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 9, cursor: 'pointer', marginBottom: 3, border: '1px solid transparent', transition: 'all .15s', animation: `fadeUp .3s ${i * .04}s ease forwards`, opacity: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#18181b'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{TEMPLATES[p.template_id]?.icon ?? '◈'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{TEMPLATES[p.template_id]?.label ?? p.template_id}</div>
                    <div style={{ fontSize: 10, color: '#52525b', marginTop: 1 }}>{new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                  <span onClick={e => { e.stopPropagation(); deleteProject(p.id); }} style={{ opacity: 0, fontSize: 12, color: '#52525b', cursor: 'pointer', padding: '2px 5px', borderRadius: 4, transition: 'all .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}>✕</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Center */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── HOME ── */}
            {view === 'home' && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', animation: 'fadeUp .5s ease' }}>
                {error && (
                  <div style={{ width: '100%', maxWidth: 700, marginBottom: 16, padding: '12px 18px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#fca5a5', fontSize: 13, display: 'flex', gap: 10 }}>
                    <span>⚠</span><span style={{ flex: 1 }}>{error}</span>
                    <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, marginBottom: 22, background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)', fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: '#818cf8', letterSpacing: '.1em' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  AI-POWERED · FREE FOREVER · NO SETUP NEEDED
                </div>
                <h1 style={{ fontSize: 'clamp(26px,5vw,52px)', fontWeight: 700, lineHeight: 1.1, textAlign: 'center', marginBottom: 16, letterSpacing: '-.02em', maxWidth: 700 }}>
                  Build <span style={{ background: 'linear-gradient(135deg,#fff,#818cf8,#06b6d4)', backgroundSize: '200%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'gradMove 4s ease infinite' }}>Full-Stack Apps</span><br />with a Single Prompt
                </h1>
                <p style={{ fontSize: 15, color: '#a1a1aa', textAlign: 'center', maxWidth: 480, marginBottom: 36, lineHeight: 1.7 }}>
                  Describe what you want. KODEX generates production-ready Next.js, TypeScript, Supabase & Tailwind code instantly.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 700, marginBottom: 36 }}>
                  {CHIPS.map(chip => (
                    <button key={chip} onClick={() => { const text = chip.replace(/^[^\s]+\s/, ''); setPrompt(text); }} style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,.1)', background: '#111114', fontSize: 12, color: '#a1a1aa', cursor: 'pointer', transition: 'all .2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,.4)'; (e.currentTarget as HTMLElement).style.color = '#fafafa'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.1)'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa'; (e.currentTarget as HTMLElement).style.background = '#111114'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
                      {chip}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginBottom: 36, flexWrap: 'wrap' }}>
                  {[['∞', 'Free Forever'], ['8', 'App Templates'], ['3', 'Output Tiers']].map(([n, l]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: 'linear-gradient(135deg,#818cf8,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{n}</div>
                      <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── GENERATING ── */}
            {view === 'generating' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: 40 }}>
                {/* Rings */}
                <div style={{ width: 100, height: 100, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {[{s:0,c:'#6366f1',d:'normal'},{s:8,c:'#06b6d4',d:'reverse'},{s:16,c:'#ec4899',d:'normal'}].map((r, i) => (
                    <div key={i} style={{ position: 'absolute', inset: r.s, borderRadius: '50%', border: '2px solid transparent', borderTopColor: r.c, animation: `${r.d === 'normal' ? 'ringFast' : 'ringMed'} ${1.2 + i * .6}s linear infinite` }} />
                  ))}
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 800, boxShadow: '0 0 30px rgba(99,102,241,.5)' }}>K</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>KODEX is building your app<span style={{ animation: 'blink 1s infinite' }}>_</span></div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#a1a1aa' }}>{phase}</div>
                <div style={{ width: 320 }}>
                  <div style={{ height: 4, background: '#18181b', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#06b6d4)', borderRadius: 4, transition: 'width .6s ease', boxShadow: '0 0 12px rgba(99,102,241,.6)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)', animation: 'shimmerBar 1.5s linear infinite', backgroundSize: '200%' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#818cf8', marginTop: 8 }}>{pct}%</div>
                </div>
                <div ref={logRef} style={{ width: 440, maxWidth: '100%', maxHeight: 120, overflowY: 'auto', background: '#111114', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '10px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#52525b', lineHeight: 1.7 }}>
                  {logs.map((l, i) => (
                    <div key={i} style={{ color: l.type === 'success' ? '#10b981' : l.type === 'error' ? '#ef4444' : '#818cf8', animation: 'fadeUp .2s ease' }}>{'> '}{l.msg}</div>
                  ))}
                </div>
              </div>
            )}

            {/* ── OUTPUT ── */}
            {view === 'output' && result && (
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Code panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
                  <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(9,9,11,.6)', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#52525b', letterSpacing: '.06em' }}>FILES</span>
                    <div style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto' }}>
                      {result.files.map((f, i) => (
                        <button key={i} onClick={() => setActiveFile(i)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: activeFile === i ? 'rgba(99,102,241,.15)' : 'transparent', color: activeFile === i ? '#818cf8' : '#71717a', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}>
                          {f.filename.split('/').pop()}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {[['⎘', copiedFile ? '✓' : '⎘', copyCode], ['↓', '↓', saveFile]].map(([_, icon, action], i) => (
                        <button key={i} onClick={action as () => void} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.07)', background: 'transparent', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, transition: 'all .15s' }}>{icon as string}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, lineHeight: 1.75, color: '#e2e8f0', background: 'rgba(0,0,0,.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {(result.files[activeFile]?.code ?? '').split('\n').map((line, i) => (
                      <span key={i} style={{ display: 'block', animation: `codeFade .15s ${i * 5}ms ease forwards`, opacity: 0 }}>{line}{'\n'}</span>
                    ))}
                  </div>
                </div>

                {/* Info panel */}
                <div style={{ width: 320, flexShrink: 0, overflowY: 'auto', padding: 18 }}>
                  {/* Summary */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 3, height: 12, background: '#6366f1', borderRadius: 2 }} />SUMMARY
                    </div>
                    <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.65 }}>{result.summary}</p>
                    {result._meta && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {[['Model', String(result._meta.model).split('-').slice(0, 2).join('-')], ['Tokens', String(result._meta.tokens)], ['Time', `${(Number(result._meta.ms) / 1000).toFixed(1)}s`]].map(([k, v]) => (
                          <span key={k} style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}><span style={{ color: '#818cf8' }}>{k}: </span>{v}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ marginBottom: 20 }}>
                    <button onClick={downloadAll} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8, transition: 'all .25s', boxShadow: '0 4px 20px rgba(99,102,241,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
                      ⬇ Download All {result.files.length} Files
                    </button>
                    <button onClick={() => setView('home')} style={{ width: '100%', padding: 11, borderRadius: 11, border: '1px solid rgba(255,255,255,.07)', background: 'transparent', color: '#a1a1aa', fontSize: 13, cursor: 'pointer', transition: 'all .2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#18181b'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      + Build Another App
                    </button>
                  </div>

                  {/* Features */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 3, height: 12, background: '#10b981', borderRadius: 2 }} />FEATURES
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.features.map((f, i) => (
                        <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: '#18181b', border: '1px solid rgba(255,255,255,.07)', fontSize: 11, color: '#a1a1aa', animation: 'fadeUp .3s ease forwards' }}>
                          <span style={{ color: '#10b981', fontSize: 9 }}>✓</span>{f}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Setup */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 3, height: 12, background: '#f59e0b', borderRadius: 2 }} />SETUP
                    </div>
                    {result.setup_steps.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, animation: 'fadeUp .3s ease forwards' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: '#818cf8', flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.6, paddingTop: 1 }}>{s}</div>
                      </div>
                    ))}
                  </div>

                  {/* Env vars */}
                  {result.env_vars.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 3, height: 12, background: '#06b6d4', borderRadius: 2 }} />ENV VARS
                      </div>
                      {result.env_vars.map((v, i) => (
                        <div key={i} style={{ padding: '6px 12px', background: '#18181b', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, marginBottom: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#06b6d4' }}>
                          {v}<span style={{ color: '#52525b' }}>=your_value</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── HISTORY ── */}
            {view === 'history' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Your Projects</div>
                <div style={{ fontSize: 13, color: '#71717a', marginBottom: 22 }}>All saved generations</div>
                {!user ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#52525b' }}>
                    <div style={{ fontSize: 40, marginBottom: 16, opacity: .3 }}>🔒</div>
                    <div style={{ marginBottom: 16 }}>Sign in to see your history</div>
                    <button onClick={() => setShowAuth(true)} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Sign In Free</button>
                  </div>
                ) : projects.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#52525b' }}>
                    <div style={{ fontSize: 40, marginBottom: 16, opacity: .3 }}>📂</div>
                    No projects yet. Build something!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {projects.map((p, i) => (
                      <div key={p.id} onClick={() => loadProject(p)} style={{ background: '#111114', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'all .2s', animation: `fadeUp .3s ${i * .05}s ease forwards`, opacity: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,.35)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 20 }}>{TEMPLATES[p.template_id]?.icon ?? '◈'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{TEMPLATES[p.template_id]?.label ?? p.template_id} App</div>
                            <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{new Date(p.created_at).toLocaleDateString()} · {p.model_used?.split('-').slice(0, 2).join('-') || 'AI'} · {p.tokens_used?.toLocaleString()} tokens</div>
                          </div>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", background: 'rgba(99,102,241,.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,.25)' }}>{p.tier_id?.toUpperCase()}</span>
                          <button onClick={e => { e.stopPropagation(); deleteProject(p.id); }} style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4, transition: 'color .15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#52525b'; }}>✕</button>
                        </div>
                        <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.55 }}>{(p.description || 'No description').slice(0, 140)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Prompt Bar (always visible on home/output) ── */}
            {(view === 'home' || view === 'output') && (
              <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,.07)', background: 'rgba(9,9,11,.9)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
                {/* Template buttons */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
                  {Object.entries(TEMPLATES).map(([id, t]) => (
                    <button key={id} onClick={() => setTemplate(id)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${template === id ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.07)'}`, background: template === id ? 'rgba(99,102,241,.1)' : 'transparent', color: template === id ? '#818cf8' : '#71717a', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .2s', flexShrink: 0, fontFamily: "'Space Grotesk',sans-serif" }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {/* Input box */}
                <div style={{ background: '#111114', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 4, boxShadow: '0 4px 24px rgba(0,0,0,.3)', transition: 'border-color .3s' }}
                  onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,.1), 0 4px 24px rgba(0,0,0,.3)'; }}
                  onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,.3)'; }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '6px 8px' }}>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); } }}
                      onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }}
                      placeholder={`Describe your ${TEMPLATES[template]?.label ?? 'app'}… e.g. "${TEMPLATES[template]?.default ?? 'What do you want to build?'}"`}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: '#fafafa', fontSize: 14, lineHeight: 1.6, resize: 'none', minHeight: 44, maxHeight: 160, padding: '8px 10px', fontFamily: "'Space Grotesk',sans-serif" }} />
                    <button onClick={generate} style={{ width: 40, height: 40, borderRadius: 11, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .25s', boxShadow: '0 0 16px rgba(99,102,241,.3)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#818cf8'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#6366f1'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 8px', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {Object.entries(TIERS).map(([id, t]) => (
                        <button key={id} onClick={() => setTier(id)} style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${tier === id ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.07)'}`, background: tier === id ? 'rgba(99,102,241,.1)' : 'transparent', color: tier === id ? '#818cf8' : '#71717a', fontSize: 11, cursor: 'pointer', transition: 'all .2s', fontFamily: "'JetBrains Mono',monospace" }}>
                          {t.label}{t.badge ? ` ·${t.badge}` : ''}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: '#52525b' }}>⌘↵ to generate · Free forever</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
