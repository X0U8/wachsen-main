import { useRef, useEffect } from 'react';
import PlanIcon from '../../ui/PlanIcon';
import { useTheme } from '../../lib/ThemeContext.tsx';

const MAX_ROT = 28;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export default function ProfileCard({ userProfile, variant }: { userProfile: any; variant: 'preview' | 'public' }) {
  const { theme, fontSizeLevel } = useTheme();
  const scale = {
    small: 0.85,
    medium: 1.0,
    large: 1.35,
    larger: 1.6
  }[fontSizeLevel] || 1.0;

  const cardRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);

  const cur = useRef({ rx: 0, ry: 0 });
  const tgt = useRef({ rx: 0, ry: 0 });
  const drag = useRef({ rx: 0, ry: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const rafId = useRef(0);

  const firstLetter = userProfile.name ? userProfile.name[0].toUpperCase() : 'U';
  const maskEmail = (email: string) => {
    const [local, domain] = (email || '').split('@');
    return domain ? `${local[0]}***@${domain}` : email;
  };

  const getShortPlanName = (planName: string) => {
    if (!planName) return '';
    if (planName.toLowerCase().includes('lite')) return 'Lite';
    if (planName.toLowerCase().includes('rise')) return 'Rise';
    if (planName.toLowerCase().includes('peak')) return 'Peak';
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
  }, [variant]);

  if (variant === 'preview') {
    return (
      <div style={{ perspective: `${700 * scale}px`, perspectiveOrigin: '50% 50%' }}>
        <div
          ref={cardRef}
          style={{
            width: `${380 * scale}px`,
            height: `${240 * scale}px`,
            borderRadius: `${16 * scale}px`,
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
              borderRadius: `${16 * scale}px`,
              background: theme === 'dark' ? '#1a1a2e' : '#ffffff',
              border: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)',
              overflow: 'hidden',
              padding: `${20 * scale}px ${20 * scale}px ${16 * scale}px`,
              display: 'flex', flexDirection: 'row', gap: `${16 * scale}px`,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            } as React.CSSProperties}
          >
            <div
              style={{
                position: 'absolute',
                top: `${12 * scale}px`,
                left: `${12 * scale}px`,
                fontSize: `${10 * scale}px`,
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                textTransform: 'uppercase',
                zIndex: 10,
              }}
            >
              Wachsen
            </div>

            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: `${16 * scale}px`,
                background: 'radial-gradient(ellipse at var(--gx,50%) var(--gy,30%), rgba(0,0,0,0.06) 0%, transparent 75%)',
                pointerEvents: 'none', zIndex: 20,
              } as React.CSSProperties}
            />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${8 * scale}px`, flexShrink: 0, justifyContent: 'center' }}>
              <div style={{
                width: `${72 * scale}px`, height: `${72 * scale}px`, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: `${26 * scale}px`, fontWeight: 500, color: '#fff', overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)', flexShrink: 0,
              } as any}>
                {userProfile.profile_picture?.trim()
                  ? <img src={userProfile.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : firstLetter}
              </div>
              {userProfile.PremiumType && (
                <div style={{ display: 'flex', alignItems: 'center', gap: `${4 * scale}px` }}>
                  <div style={{
                    width: `${60 * scale}px`, height: `${24 * scale}px`, borderRadius: `${6 * scale}px`,
                    background: theme === 'dark' ? '#0f0f23' : '#1e293b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: `${4 * scale}px`,
                  }}>
                    <PlanIcon planName={userProfile.PremiumType} variant="profileCard" />
                    <span style={{
                      fontSize: `${9 * scale}px`, fontWeight: 600, letterSpacing: '0.05em',
                      color: '#ffffff', textTransform: '',
                    }}>
                      {getShortPlanName(userProfile.PremiumType)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ width: '0.5px', background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', alignSelf: 'stretch', flexShrink: 0 }} />

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: `${10 * scale}px`, marginTop: `${30 * scale}px`, flex: 1 }}>
                {([
                  { l: 'NAME', v: userProfile.name?.toUpperCase() },
                  { l: 'USER ID', v: `@${userProfile.username || ''}` },
                  userProfile.DOB && { l: 'DOB', v: userProfile.DOB },
                  userProfile.gender && { l: 'GENDER', v: userProfile.gender?.toUpperCase() },
                  userProfile.country && { l: 'NATION', v: userProfile.country?.toUpperCase() },
                ] as any[]).filter(Boolean).map((f: any) => (
                  <div key={f.l} style={{ display: 'flex', alignItems: 'baseline', gap: `${10 * scale}px` }}>
                    <span style={{ fontSize: `${10 * scale}px`, textTransform: '', letterSpacing: '0.09em', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', flexShrink: 0, width: `${65 * scale}px`, fontWeight: 500 }}>{f.l}</span>
                    <span style={{
                      fontSize: f.l === 'Name' ? `${12 * scale}px` : `${11 * scale}px`,
                      fontWeight: f.l === 'Name' ? 700 : 400,
                      color: theme === 'dark' ? '#ffffff' : '#000000',
                      fontFamily: f.l === 'Name' ? "'DM Sans', system-ui, sans-serif" : "'DM Mono',monospace",
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
                    }}>{f.v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: `${8 * scale}px`, borderTop: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: `${9 * scale}px`, fontWeight: 500, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', letterSpacing: '0.05em' }}>
                  Member since {new Date(userProfile.created_at || userProfile.id).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <div style={{ display: 'flex', gap: `${3 * scale}px` }}>
                  {[0.32, 0.18, 0.09].map((o, i) => <div key={i} style={{ width: `${5 * scale}px`, height: `${5 * scale}px`, borderRadius: '50%', background: theme === 'dark' ? `rgba(255,255,255,${o})` : `rgba(0,0,0,${o})` }} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ perspective: `${700 * scale}px`, perspectiveOrigin: '50% 50%' }}>
      <div
        ref={cardRef}
        style={{
          width: `${350 * scale}px`,
          height: `${220 * scale}px`,
          borderRadius: `${16 * scale}px`,
          position: 'relative',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          cursor: 'grab',
          boxShadow: '0 12px 36px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)',
        }}
      >
        <div
          ref={faceRef}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: `${16 * scale}px`,
            background: theme === 'dark' ? '#1a1a2e' : '#ffffff',
            border: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)',
            overflow: 'hidden',
            padding: `${16 * scale}px ${16 * scale}px ${12 * scale}px`,
            display: 'flex', flexDirection: 'row', gap: `${14 * scale}px`,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          } as React.CSSProperties}
        >
          <div
            style={{
              position: 'absolute',
              top: `${10 * scale}px`,
              left: `${10 * scale}px`,
              fontSize: `${9 * scale}px`,
              fontWeight: 750,
              letterSpacing: '0.15em',
              color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              textTransform: '',
              zIndex: 10,
            }}
          >
            Wachsen
          </div>

          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: `${16 * scale}px`,
              background: 'radial-gradient(ellipse at var(--gx,50%) var(--gy,30%), rgba(0,0,0,0.06) 0%, transparent 75%)',
              pointerEvents: 'none', zIndex: 20,
            } as React.CSSProperties}
          />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${6 * scale}px`, flexShrink: 0, justifyContent: 'center' }}>
            <div style={{
              width: `${64 * scale}px`, height: `${64 * scale}px`, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: `${24 * scale}px`, fontWeight: 500, color: '#fff', overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0,
            }}>
              {userProfile.profile_picture?.trim()
                ? <img src={userProfile.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : firstLetter}
            </div>
            {userProfile.PremiumType && (
              <div style={{ display: 'flex', alignItems: 'center', gap: `${4 * scale}px` }}>
                <div style={{
                  width: `${54 * scale}px`, height: `${22 * scale}px`, borderRadius: `${5 * scale}px`,
                  background: theme === 'dark' ? '#0f0f23' : '#1e293b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: `${3 * scale}px`,
                }}>
                  <PlanIcon planName={userProfile.PremiumType} variant="profileCard" />
                  <span style={{
                    fontSize: `${8 * scale}px`, fontWeight: 600, letterSpacing: '0.05em',
                    color: '#ffffff', textTransform: '',
                  }}>
                    {getShortPlanName(userProfile.PremiumType)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: '0.5px', background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', alignSelf: 'stretch', flexShrink: 0 }} />

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * scale}px`, marginTop: `${24 * scale}px`, flex: 1 }}>
              {([
                { l: 'Name', v: userProfile.name?.toUpperCase() },
                { l: 'User ID', v: `@${userProfile.username || ''}` },
                { l: 'Email', v: maskEmail(userProfile.email || '') },
                userProfile.DOB && { l: 'DOB', v: userProfile.DOB },
                userProfile.gender && { l: 'Gender', v: userProfile.gender },
                userProfile.country && { l: 'Nation', v: userProfile.country },
              ] as any[]).filter(Boolean).map((f: any) => (
                <div key={f.l} style={{ display: 'flex', alignItems: 'baseline', gap: `${8 * scale}px` }}>
                  <span style={{ fontSize: `${9 * scale}px`, textTransform: '', letterSpacing: '0.09em', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', flexShrink: 0, width: `${55 * scale}px`, fontWeight: 500 }}>{f.l}</span>
                  <span style={{
                    fontSize: f.l === 'Name' ? `${11 * scale}px` : `${10 * scale}px`,
                    fontWeight: f.l === 'Name' ? 700 : 400,
                    color: theme === 'dark' ? '#ffffff' : '#000000',
                    fontFamily: f.l === 'Name' ? "'DM Sans', system-ui, sans-serif" : "'DM Mono',monospace",
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
                  }}>{f.v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: `${6 * scale}px`, borderTop: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)' }}>
              <span style={{ fontSize: `${8 * scale}px`, fontWeight: 500, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', letterSpacing: '0.05em' }}>
                Member since {new Date(userProfile.created_at || userProfile.id).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <div style={{ display: 'flex', gap: `${3 * scale}px` }}>
                {[0.32, 0.18, 0.09].map((o, i) => <div key={i} style={{ width: `${4 * scale}px`, height: `${4 * scale}px`, borderRadius: '50%', background: theme === 'dark' ? `rgba(255,255,255,${o})` : `rgba(0,0,0,${o})` }} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
