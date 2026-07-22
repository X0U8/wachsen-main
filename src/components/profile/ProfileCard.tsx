import { useRef, useEffect, useMemo } from 'react';
import PlanIcon from '../../ui/PlanIcon';
import { useTheme } from '../../lib/ThemeContext.tsx';
import { useCachedImage } from '../../hooks/useCachedImage';

const MAX_ROT = 28;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function formatNiceDate(input: string | number | Date | undefined | null): string {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  return `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function capitalize(s?: string) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 233280;
  return h || 42;
}

function DotPanel({
  src, seed, width, height, dotColor, bgColor, topInset = 0, margin = 2, fallbackLetter,
}: {
  src?: string; seed: number; width: number; height: number; dotColor: string; bgColor: string; topInset?: number; margin?: number; fallbackLetter?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    const cell = Math.max(6, Math.round(w / 13));
    const top = margin + topInset;
    const m = margin;
    const rm = 0;

    const drawGenerative = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
      let s = seed;
      const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      const cx = w / 2, cy = (h + top) / 2, maxDist = Math.sqrt(cx * cx + cy * cy);
      for (let y = top; y < h - m; y += cell) {
        for (let x = m; x < w - rm; x += cell) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
          const noise = rand();
          const intensity = Math.max(0, 1 - dist * 1.15) * 0.7 + noise * 0.3;
          if (intensity > 0.15) {
            ctx.fillStyle = dotColor;
            const size = (cell - 2) * (0.5 + intensity * 0.5);
            const off = (cell - 2 - size) / 2;
            ctx.beginPath();
            ctx.roundRect(x + off, y + off, size, size, 2);
            ctx.fill();
          }
        }
      }
    };

    const drawLetter = (letter: string) => {
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const octx = off.getContext('2d');
      if (!octx) { drawGenerative(); return; }

      octx.fillStyle = '#000000';
      octx.fillRect(0, 0, w, h);
      octx.fillStyle = '#ffffff';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';


      const maxTextWidth = w - m * 2 - cell;
      let fontSize = Math.round(h * 0.65);
      octx.font = `bold ${fontSize}px 'DM Sans', system-ui, sans-serif`;
      const measured = octx.measureText(letter).width;
      if (measured > maxTextWidth) {
        fontSize = Math.max(10, Math.floor(fontSize * (maxTextWidth / measured)));
        octx.font = `bold ${fontSize}px 'DM Sans', system-ui, sans-serif`;
      }
      octx.fillText(letter, w / 2, h / 2);

      const data = octx.getImageData(0, 0, w, h).data;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);



      const textThreshold = 0.35;
      for (let y = top; y < h - m; y += cell) {
        for (let x = m; x < w - rm; x += cell) {
          const i = (Math.floor(y) * w + Math.floor(x)) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          const intensity = 1 - lum;
          if (intensity > textThreshold) {
            ctx.fillStyle = dotColor;
            const size = (cell - 2) * 0.85;
            const offp = (cell - 2 - size) / 2;
            ctx.beginPath();
            ctx.roundRect(x + offp, y + offp, size, size, 2);
            ctx.fill();
          }
        }
      }
    };

    if (!src || !src.trim()) {
      if (fallbackLetter) {
        drawLetter(fallbackLetter);
      } else {
        drawGenerative();
      }
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const octx = off.getContext('2d');
        if (!octx) throw new Error('no offscreen ctx');

        const ir = img.width / img.height;
        const cr = w / h;
        let dw: number, dh: number, dx: number, dy: number;
        if (ir > cr) { dh = h; dw = h * ir; dx = (w - dw) / 2; dy = 0; }
        else { dw = w; dh = w / ir; dx = 0; dy = (h - dh) / 2; }
        octx.drawImage(img, dx, dy, dw, dh);

        const data = octx.getImageData(0, 0, w, h).data;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);

        for (let y = top; y < h - m; y += cell) {
          for (let x = m; x < w - rm; x += cell) {
            const i = (Math.floor(y) * w + Math.floor(x)) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            const intensity = 1 - lum;
            if (intensity > 0.08) {
              ctx.fillStyle = dotColor;
              ctx.globalAlpha = Math.min(1, intensity * 1.2);
              const size = (cell - 2) * Math.min(1, intensity * 1.3 + 0.25);
              const offp = (cell - 2 - size) / 2;
              ctx.beginPath();
              ctx.roundRect(x + offp, y + offp, size, size, 2);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          }
        }
      } catch {
        drawGenerative();
      }
    };
    img.onerror = () => { if (!cancelled) drawGenerative(); };
    img.src = src;

    return () => { cancelled = true; };
  }, [src, seed, width, height, dotColor, bgColor, topInset, fallbackLetter]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', flexShrink: 0, opacity: 0.8, filter: 'saturate(0.95)' }} />;
}

export default function ProfileCard({ userProfile, variant }: { userProfile: any; variant: 'preview' | 'public' }) {
  const { theme, fontSizeLevel } = useTheme();
  const scale = {
    small: 0.85,
    medium: 1.0,
    large: 1.35,
    larger: 1.6
  }[fontSizeLevel] || 1.0;

  const cachedProfilePicture = useCachedImage(userProfile.profile_picture);

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

  const getShortPlanName = (planName: string) => {
    if (!planName) return '';
    if (planName.toLowerCase().includes('lite')) return 'Lite';
    if (planName.toLowerCase().includes('rise')) return 'Rise';
    if (planName.toLowerCase().includes('peak')) return 'Peak';
    return planName;
  };

  const seed = useMemo(
    () => hashSeed(String(userProfile.username || userProfile.id || userProfile.name || 'wachsen')),
    [userProfile.username, userProfile.id, userProfile.name]
  );

  const CARD_BG = 'linear-gradient(135deg, #20213d 0%, #1a1a30 55%, #151525 100%)';
  const pal = {
    bg: CARD_BG,
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.52)',
    faint: 'rgba(255,255,255,0.28)',
    border: 'rgba(255,255,255,0.07)',
    dotBg: '#181242',
    dotColor: '#7aadff',
  };
  const baseShadow = variant === 'preview'
    ? '0 18px 54px rgba(0,0,0,0.55), 0 4px 18px rgba(0,0,0,0.35)'
    : '0 14px 42px rgba(0,0,0,0.45), 0 4px 14px rgba(0,0,0,0.28)';

  const applyTransform = (rx: number, ry: number) => {
    const card = cardRef.current;
    const face = faceRef.current;
    if (!card || !face) return;

    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;

    const mag = Math.sqrt(rx * rx + ry * ry);
    const sx = -ry * 0.55;
    const sy = rx * 0.55 + 16;
    const blur = 24 + mag * 0.8;
    const alpha = Math.min(0.56, 0.22 + mag * 0.006);
    card.style.boxShadow = `${sx}px ${sy}px ${blur}px rgba(0,0,0,${alpha.toFixed(3)}), 0 4px 16px rgba(0,0,0,0.34)`;

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

  const fields = [
    userProfile.DOB && { l: 'DOB', v: formatNiceDate(userProfile.DOB) },
    userProfile.gender && { l: 'Gender', v: capitalize(userProfile.gender) },
    userProfile.country && { l: 'Nation', v: capitalize(userProfile.country) },
  ].filter(Boolean) as { l: string; v: string }[];

  const memberSince = formatNiceDate(userProfile.created_at);

  const cardWidth = (variant === 'preview' ? 380 : 350) * scale;
  const cardHeight = (variant === 'preview' ? 240 : 220) * scale;
  const panelWidth = Math.round((variant === 'preview' ? 118 : 108) * scale);
  const radius = 16 * scale;

  return (
    <div style={{ perspective: `${700 * scale}px`, perspectiveOrigin: '50% 50%' }}>
      <div
        ref={cardRef}
        style={{
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          borderRadius: `${radius}px`,
          position: 'relative',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          cursor: 'grab',
          boxShadow: baseShadow,
        }}
      >
        <div
          ref={faceRef}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: `${radius}px`,
            background: pal.bg,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'row',
            fontFamily: "'DM Sans', system-ui, sans-serif",
          } as React.CSSProperties}
        >
          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: `${radius}px`,
              background: 'radial-gradient(ellipse at var(--gx,50%) var(--gy,30%), rgba(107,157,255,0.10) 0%, transparent 60%)',
              pointerEvents: 'none', zIndex: 20,
            } as React.CSSProperties}
          />

          <div
            style={{
              flex: 1, minWidth: 0,
              padding: `${(variant === 'preview' ? 20 : 18) * scale}px ${(variant === 'preview' ? 20 : 18) * scale}px ${(variant === 'preview' ? 16 : 14) * scale}px`,
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: `${10 * scale}px` }}>
              <div style={{
                width: `${42 * scale}px`, height: `${42 * scale}px`, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: `${17 * scale}px`, fontWeight: 600, color: '#fff', overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.15)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
                flexShrink: 0,
              }}>
                {cachedProfilePicture?.trim()
                  ? <img src={cachedProfilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : firstLetter}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: `${16 * scale}px`, fontWeight: 700, color: pal.text,
                  maxWidth: `${190 * scale}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '0.02em',
                }}>
                  {userProfile.name}
                </div>
                <div style={{
                  fontSize: `${11 * scale}px`, fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em',
                  color: pal.muted, marginTop: `${4 * scale}px`,
                }}>
                  @{userProfile.username || ''}
                </div>
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * scale}px`, marginLeft: `${10 * scale}px` }}>
              {fields.map(f => (
                <div key={f.l} style={{ display: 'flex', alignItems: 'baseline', gap: `${6 * scale}px` }}>
                  <span style={{
                    fontSize: `${10 * scale}px`, fontWeight: 600,
                    color: pal.muted, letterSpacing: '0.06em', width: `${68 * scale}px`, flexShrink: 0,
                    textTransform: 'uppercase',
                  }}>
                    {f.l}
                  </span>
                  <span style={{
                    fontSize: `${10 * scale}px`,
                    fontFamily: "'DM Mono', monospace", letterSpacing: '0.02em',
                    color: pal.text, textTransform: 'uppercase',
                  }}>
                    {f.v}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            <div>
              <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.07)', marginBottom: `${10 * scale}px` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: `${8 * scale}px`, fontWeight: 500, color: pal.muted, letterSpacing: '0.03em' }}>
                  {memberSince ? `Member Since  ${memberSince}` : ''}
                </span>
                {userProfile.PremiumType && (
                  <div style={{
                    padding: `${3 * scale}px ${8 * scale}px`, borderRadius: `${4 * scale}px`,
                    background: 'rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', gap: `${4 * scale}px`,
                  }}>
                    <PlanIcon planName={userProfile.PremiumType} variant="profileCard" />
                    <span style={{ fontSize: `${8 * scale}px`, fontWeight: 600, letterSpacing: '0.06em', color: '#ffffff', textTransform: 'uppercase' }}>
                      {getShortPlanName(userProfile.PremiumType)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', width: `${panelWidth}px`, position: 'relative' }}>
            <div style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              borderLeft: '0.5px solid rgba(255,255,255,0.045)',
              background: '#181242',
              boxShadow: 'inset 8px 0 24px rgba(80,40,180,0.15)',
              WebkitMaskImage: 'linear-gradient(to left, transparent 0%, black 18%)',
              maskImage: 'linear-gradient(to left, transparent 0%, black 18%)',
            }}>
              <div style={{
                height: `${12 * scale}px`, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: '0.5px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{
                  fontSize: `${9 * scale}px`, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.60)',
                }}>
                  Wachsen
                </span>
              </div>
              <DotPanel
                src={cachedProfilePicture}
                seed={seed}
                width={panelWidth}
                height={Math.round(cardHeight - 12 * scale)}
                dotColor={pal.dotColor}
                bgColor={pal.dotBg}
                fallbackLetter={firstLetter}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}