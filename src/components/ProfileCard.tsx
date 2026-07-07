import { Clipboard, Check, X } from 'lucide-react';
import { useUserProfile } from '../lib/UserContext.tsx';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PlanIcon from '../ui/PlanIcon';
import { fontSize } from '../lib/utils';
import { useTheme } from '../lib/ThemeContext.tsx';

const MAX_ROT = 28;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export default function ProfileCard({ onClose }: { onClose: () => void }) {
  const { userProfile } = useUserProfile();
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const cardRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);

  const cur   = useRef({ rx: 0, ry: 0 });
  const tgt   = useRef({ rx: 0, ry: 0 });
  const drag  = useRef({ rx: 0, ry: 0 });
  const vel   = useRef({ x: 0, y: 0 });
  const last  = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const rafId = useRef(0);

  if (!userProfile) return null;

  const copyId = () => {
    navigator.clipboard.writeText(userProfile.username || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const firstLetter = userProfile.name ? userProfile.name[0].toUpperCase() : 'U';
  const maskEmail = (email: string) => {
    const [local, domain] = (email || '').split('@');
    return domain ? `${local[0]}***@${domain}` : email;
  };

  const getShortPlanName = (planName: string) => {
    if (!planName) return '';
    if (planName.includes('Lite')) return 'Lite';
    if (planName.includes('Rise')) return 'Rise';
    if (planName.includes('Peak')) return 'Peak';
    return planName;
  };

  const applyTransform = (rx: number, ry: number) => {
    const card = cardRef.current;
    const face = faceRef.current;
    if (!card || !face) return;

    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;

    const mag = Math.sqrt(rx * rx + ry * ry);
    const sx = -ry * 0.55;
    const sy = rx * 0.55 + 16;
    const blur = 24 + mag * 0.8;
    const alpha = Math.min(0.55, 0.22 + mag * 0.006);
    card.style.boxShadow = `${sx}px ${sy}px ${blur}px rgba(0,0,0,${alpha.toFixed(3)}), 0 4px 16px rgba(0,0,0,0.3)`;

    const gx = clamp(50 - ry * 1.1, 10, 90);
    const gy = clamp(30 + rx * 1.1, 5, 85);
    face.style.setProperty('--gx', `${gx}%`);
    face.style.setProperty('--gy', `${gy}%`);
  };

  useEffect(() => {
    const tick = () => {
      cur.current.rx = lerp(cur.current.rx, tgt.current.rx, dragging.current ? 0.22 : 0.09);
      cur.current.ry = lerp(cur.current.ry, tgt.current.ry, dragging.current ? 0.22 : 0.09);
      applyTransform(cur.current.rx, cur.current.ry);
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const onMouseLeave = () => { if (!dragging.current) { tgt.current.rx = 0; tgt.current.ry = 0; } };

    const onMouseDown = (e: MouseEvent) => {
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      drag.current = { ...cur.current };
      vel.current = { x: 0, y: 0 };
      card.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const onMouseMoveDrag = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      vel.current = { x: dx, y: dy };
      drag.current.ry = clamp(drag.current.ry + dx * 0.55, -MAX_ROT, MAX_ROT);
      drag.current.rx = clamp(drag.current.rx - dy * 0.55, -MAX_ROT * 0.7, MAX_ROT * 0.7);
      tgt.current.rx = drag.current.rx;
      tgt.current.ry = drag.current.ry;
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      card.style.cursor = 'grab';
      let mx = vel.current.x * 0.4, my = vel.current.y * 0.4;
      const decay = () => {
        if (Math.abs(mx) < 0.1 && Math.abs(my) < 0.1) { tgt.current.rx = 0; tgt.current.ry = 0; return; }
        mx *= 0.88; my *= 0.88;
        drag.current.ry = clamp(drag.current.ry + mx * 0.45, -MAX_ROT, MAX_ROT);
        drag.current.rx = clamp(drag.current.rx - my * 0.45, -MAX_ROT * 0.7, MAX_ROT * 0.7);
        tgt.current.rx = drag.current.rx;
        tgt.current.ry = drag.current.ry;
        requestAnimationFrame(decay);
      };
      decay();
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      dragging.current = true;
      last.current = { x: t.clientX, y: t.clientY };
      drag.current = { ...cur.current };
      vel.current = { x: 0, y: 0 };
      e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      const dx = t.clientX - last.current.x;
      const dy = t.clientY - last.current.y;
      last.current = { x: t.clientX, y: t.clientY };
      vel.current = { x: dx, y: dy };
      drag.current.ry = clamp(drag.current.ry + dx * 0.6, -MAX_ROT, MAX_ROT);
      drag.current.rx = clamp(drag.current.rx - dy * 0.6, -MAX_ROT * 0.7, MAX_ROT * 0.7);
      tgt.current.rx = drag.current.rx;
      tgt.current.ry = drag.current.ry;
      e.preventDefault();
    };
    const onTouchEnd = () => {
      dragging.current = false;
      let mx = vel.current.x * 0.35, my = vel.current.y * 0.35;
      const decay = () => {
        if (Math.abs(mx) < 0.1 && Math.abs(my) < 0.1) { tgt.current.rx = 0; tgt.current.ry = 0; return; }
        mx *= 0.86; my *= 0.86;
        drag.current.ry = clamp(drag.current.ry + mx * 0.45, -MAX_ROT, MAX_ROT);
        drag.current.rx = clamp(drag.current.rx - my * 0.45, -MAX_ROT * 0.7, MAX_ROT * 0.7);
        tgt.current.rx = drag.current.rx;
        tgt.current.ry = drag.current.ry;
        requestAnimationFrame(decay);
      };
      decay();
    };

    card.addEventListener('mouseleave', onMouseLeave);
    card.addEventListener('mousedown', onMouseDown);
    card.addEventListener('touchstart', onTouchStart, { passive: false });
    card.addEventListener('touchmove', onTouchMove, { passive: false });
    card.addEventListener('touchend', onTouchEnd);
    window.addEventListener('mousemove', onMouseMoveDrag);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      card.removeEventListener('mouseleave', onMouseLeave);
      card.removeEventListener('mousedown', onMouseDown);
      card.removeEventListener('touchstart', onTouchStart);
      card.removeEventListener('touchmove', onTouchMove);
      card.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMoveDrag);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex justify-between items-center px-6 pt-6 pb-2">
        <h1 className="font-medium tracking-tight text-white" style={{ fontSize: fontSize.xl }}>Glix UP</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={copyId}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2 text-zinc-400 hover:text-white"
            title="Copy ID"
          >
            {copied ? <Check className="w-5 h-5 text-green-400" /> : <Clipboard className="w-5 h-5" />}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div style={{ perspective: '700px', perspectiveOrigin: '50% 50%' }}>
          <div
            ref={cardRef}
            style={{
              width: '380px',
              height: '240px',
              borderRadius: '16px',
              position: 'relative',
              transformStyle: 'preserve-3d',
              willChange: 'transform',
              cursor: 'grab',
              boxShadow: '0 16px 48px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <div
              ref={faceRef}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: '16px',
                background: theme === 'dark' ? '#1a1a2e' : '#ffffff',
                border: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)',
                overflow: 'hidden',
                padding: '20px 20px 16px',
                display: 'flex', flexDirection: 'row', gap: '16px',
                fontFamily: "'DM Sans', system-ui, sans-serif",
              } as React.CSSProperties}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  textTransform: 'uppercase',
                  zIndex: 10,
                }}
              >
                GLIX TEST
              </div>

              <div
                style={{
                  position: 'absolute', inset: 0, borderRadius: '16px',
                  background: 'radial-gradient(ellipse at var(--gx,50%) var(--gy,30%), rgba(0,0,0,0.06) 0%, transparent 75%)',
                  pointerEvents: 'none', zIndex: 20,
                } as React.CSSProperties}
              />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0, justifyContent: 'center' }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', fontWeight: 500, color: '#fff', overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)', flexShrink: 0,
                }}>
                  {userProfile.profile_picture?.trim()
                    ? <img src={userProfile.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : firstLetter}
                </div>
                {userProfile.PremiumType && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '60px', height: '24px', borderRadius: '6px',
                      background: theme === 'dark' ? '#0f0f23' : '#1e293b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    }}>
                      <PlanIcon planName={userProfile.PremiumType} />
                      <span style={{
                        fontSize: '9px', fontWeight: 600, letterSpacing: '0.05em',
                        color: '#ffffff', textTransform: 'uppercase',
                      }}>
                        {getShortPlanName(userProfile.PremiumType)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ width: '0.5px', background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', alignSelf: 'stretch', flexShrink: 0 }} />

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '30px', flex: 1 }}>
                  {([
                    { l: 'Name',   v: userProfile.name?.toUpperCase() },
                    { l: 'USER ID', v: `@${userProfile.username || ''}` },
                    { l: 'Email',  v: maskEmail(userProfile.email || '') },
                    userProfile.DOB     && { l: 'DOB',    v: userProfile.DOB },
                    userProfile.gender  && { l: 'Gender', v: userProfile.gender },
                    userProfile.country && { l: 'Nation', v: userProfile.country },
                  ] as any[]).filter(Boolean).map((f: any) => (
                    <div key={f.l} style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.09em', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', flexShrink: 0, width: '65px', fontWeight: 500 }}>{f.l}</span>
                      <span style={{
                        fontSize: f.l === 'Name' ? '12px' : '11px',
                        fontWeight: f.l === 'Name' ? 700 : 400,
                        color: theme === 'dark' ? '#ffffff' : '#000000',
                        fontFamily: f.l === 'Name' ? "'DM Sans', system-ui, sans-serif" : "'DM Mono',monospace",
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
                      }}>{f.v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)' }}>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', letterSpacing: '0.05em' }}>
                    Member since — {new Date(userProfile.created_at || userProfile.id).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[0.32, 0.18, 0.09].map((o, i) => <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: theme === 'dark' ? `rgba(255,255,255,${o})` : `rgba(0,0,0,${o})` }} />)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-8 px-6 py-2.5 bg-white/10 hover:bg-white/15 transition-colors rounded-xl text-white font-medium"
          style={{ fontSize: fontSize.sm }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
