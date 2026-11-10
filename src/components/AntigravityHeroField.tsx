import React, { useEffect, useRef } from 'react';

interface AntigravityHeroFieldProps {
  className?: string;
  brandColor?: string; // default #0A4595
}

interface StarParticle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  angle: number;
  rotationSpeed: number;
  twinkleSpeed: number;
  twinklePhase: number;
  baseAlpha: number;
  alpha: number;
  color: string;
  glowColor: string;
  starType: 'sparkle4' | 'sparkle8' | 'stardust';
  seed: number;
}

// 4-Point Concave Sparkle Star (Classic diamond starburst)
function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  outerSize: number,
  innerRatio = 0.16
) {
  const inner = outerSize * innerRatio;
  ctx.beginPath();
  ctx.moveTo(0, -outerSize);
  ctx.quadraticCurveTo(0, -inner, inner, 0);
  ctx.lineTo(outerSize, 0);
  ctx.quadraticCurveTo(inner, 0, 0, inner);
  ctx.lineTo(0, outerSize);
  ctx.quadraticCurveTo(0, inner, -inner, 0);
  ctx.lineTo(-outerSize, 0);
  ctx.quadraticCurveTo(-inner, 0, 0, -inner);
  ctx.closePath();
  ctx.fill();
}

// 8-Point Double Sparkle Star (Radiant hero star)
function drawEightPointStar(
  ctx: CanvasRenderingContext2D,
  outerSize: number
) {
  // Primary 4 points
  drawFourPointStar(ctx, outerSize, 0.18);
  // Secondary 4 diagonal points (smaller, 55% size)
  ctx.save();
  ctx.rotate(Math.PI / 4);
  drawFourPointStar(ctx, outerSize * 0.55, 0.18);
  ctx.restore();
}

export const AntigravityHeroField: React.FC<AntigravityHeroFieldProps> = ({
  className = '',
  brandColor = '#0A4595',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let stars: StarParticle[] = [];

    // Mouse tracking with smooth lerp
    const mouse = {
      x: -9999,
      y: -9999,
      targetX: -9999,
      targetY: -9999,
      vx: 0,
      vy: 0,
      active: false,
      lastMoveTime: 0,
    };

    // Shimmering luminous blue star palette for deep cosmic dark background
    const STAR_PALETTES = [
      { color: '#38BDF8', glow: 'rgba(56, 189, 248, 0.80)' }, // Celestial Sky Blue
      { color: '#60A5FA', glow: 'rgba(96, 165, 250, 0.75)' }, // Luminous Azure
      { color: '#2563EB', glow: 'rgba(37, 99, 235, 0.70)' },  // Electric Blue
      { color: '#1264D4', glow: 'rgba(18, 100, 212, 0.65)' }, // Brand Deep Blue
      { color: '#93C5FD', glow: 'rgba(147, 197, 253, 0.85)' },// Starlight Ice Blue
      { color: '#BAE6FD', glow: 'rgba(186, 230, 253, 0.90)' },// Diamond Star Core
    ];

    const initStars = (w: number, h: number) => {
      stars = [];
      const centerX = w * 0.5;
      const centerY = h * 0.48;

      // Density of sparkling stars adapting smoothly to viewport
      const count = Math.min(360, Math.max(140, Math.floor((w * h) / 3200)));

      for (let i = 0; i < count; i++) {
        // Celestial orbital distribution surrounding the headline and CTA
        const radiusFraction = Math.pow(Math.random(), 0.68);
        const maxR = Math.max(w, h) * 0.72;
        const minR = 55;
        const r = minR + radiusFraction * (maxR - minR);

        const angle = Math.random() * Math.PI * 2;
        const baseX = centerX + Math.cos(angle) * r + (Math.random() - 0.5) * 40;
        const baseY =
          centerY + Math.sin(angle) * r * 0.72 + (Math.random() - 0.5) * 40;

        // Choose star type: 50% 4-point sparkle, 35% glowing stardust, 15% 8-point bright star
        const randType = Math.random();
        let starType: StarParticle['starType'] = 'sparkle4';
        let baseSize = 5 + Math.random() * 8; // 5px - 13px radius

        if (randType < 0.35) {
          starType = 'stardust';
          baseSize = 2 + Math.random() * 2.5; // 2px - 4.5px radius
        } else if (randType > 0.85) {
          starType = 'sparkle8';
          baseSize = 8 + Math.random() * 8; // 8px - 16px radius
        }

        const palette =
          STAR_PALETTES[Math.floor(Math.random() * STAR_PALETTES.length)];
        const baseAlpha = 0.22 + Math.random() * 0.62;

        stars.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: baseSize,
          baseSize,
          angle: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.008,
          twinkleSpeed: 0.8 + Math.random() * 1.8,
          twinklePhase: Math.random() * Math.PI * 2,
          baseAlpha,
          alpha: baseAlpha,
          color: palette.color,
          glowColor: palette.glow,
          starType,
          seed: Math.random() * 1000,
        });
      }
    };

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      initStars(width, height);
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Mouse movement tracking
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = container.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      } else {
        return;
      }

      if (
        clientX >= rect.left - 80 &&
        clientX <= rect.right + 80 &&
        clientY >= rect.top - 80 &&
        clientY <= rect.bottom + 80
      ) {
        mouse.targetX = clientX - rect.left;
        mouse.targetY = clientY - rect.top;
        mouse.active = true;
        mouse.lastMoveTime = performance.now();
      } else {
        mouse.active = false;
      }
    };

    const handlePointerLeave = () => {
      mouse.active = false;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // Smooth mouse coordinate interpolation
      if (mouse.active) {
        const mouseEase = 0.22;
        const prevMx = mouse.x;
        const prevMy = mouse.y;
        mouse.x += (mouse.targetX - mouse.x) * mouseEase;
        mouse.y += (mouse.targetY - mouse.y) * mouseEase;
        mouse.vx = mouse.x - prevMx;
        mouse.vy = mouse.y - prevMy;
      } else {
        mouse.x = -9999;
        mouse.y = -9999;
        mouse.vx = 0;
        mouse.vy = 0;
      }

      const interactionRadius = 210;
      const interactionRadiusSq = interactionRadius * interactionRadius;
      const spring = 0.055;
      const friction = 0.88;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // 1. Gentle celestial floating oscillation
        const idleOffsetX = Math.cos(time * 0.001 + s.seed) * 4;
        const idleOffsetY = Math.sin(time * 0.0013 + s.seed) * 4;
        const currentTargetX = s.baseX + idleOffsetX;
        const currentTargetY = s.baseY + idleOffsetY;

        // 2. Interactive Cursor Dynamics (Repulsion, Starburst flare, and Glow)
        let isInfluenced = false;
        let cursorForce = 0;

        if (mouse.active) {
          const dx = s.x - mouse.x;
          const dy = s.y - mouse.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < interactionRadiusSq && distSq > 0.01) {
            isInfluenced = true;
            const dist = Math.sqrt(distSq);
            cursorForce = 1 - dist / interactionRadius;

            // Antigravity push away from cursor
            const pushMagnitude = cursorForce * 75;
            const normalX = dx / dist;
            const normalY = dy / dist;

            s.vx += normalX * pushMagnitude * dt * 10;
            s.vy += normalY * pushMagnitude * dt * 10;

            // Swipe momentum
            s.vx += mouse.vx * cursorForce * 0.25;
            s.vy += mouse.vy * cursorForce * 0.25;

            // Faster shimmer / star spin when hovered
            s.angle += s.rotationSpeed * (1 + cursorForce * 4);

            // Shimmer flare opacity near cursor
            s.alpha = Math.min(1.0, s.baseAlpha + cursorForce * 0.55);
          }
        }

        if (!isInfluenced) {
          s.alpha += (s.baseAlpha - s.alpha) * 0.05;
          s.angle += s.rotationSpeed;
        }

        // 3. Spring back towards home base
        const toBaseX = currentTargetX - s.x;
        const toBaseY = currentTargetY - s.y;
        s.vx += toBaseX * spring;
        s.vy += toBaseY * spring;

        s.vx *= friction;
        s.vy *= friction;

        s.x += s.vx;
        s.y += s.vy;

        // 4. Twinkle calculation: pulsating brightness & size shimmer
        const twinkleCycle = Math.sin(
          time * 0.0022 * s.twinkleSpeed + s.twinklePhase
        );
        const twinkleFactor = 0.72 + 0.28 * twinkleCycle;
        const renderAlpha = Math.max(
          0.12,
          Math.min(1.0, s.alpha * twinkleFactor + cursorForce * 0.3)
        );
        const renderSize =
          s.size * (0.85 + 0.25 * twinkleCycle) * (1 + cursorForce * 0.38);

        // 5. Render Crisp Sparkling Blue Star (No blurry glow smudge)
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = renderAlpha;

        if (s.starType === 'stardust') {
          // Sharp circular stardust point with tiny diamond twinkle core
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(1.2, renderSize * 0.75), 0, Math.PI * 2);
          ctx.fill();

          // White starlight spark at the exact center
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = Math.min(1.0, renderAlpha * 1.1);
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(0.6, renderSize * 0.35), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 4-Point or 8-Point Crisp Sparkling Star
          // Star Body in brilliant brand/celestial blue
          ctx.fillStyle = s.color;
          if (s.starType === 'sparkle8') {
            drawEightPointStar(ctx, renderSize);
          } else {
            drawFourPointStar(ctx, renderSize, 0.16);
          }

          // Sparkling white diamond starlet core at the intersection
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = Math.min(1.0, renderAlpha * 1.15);
          drawFourPointStar(ctx, renderSize * 0.42, 0.22);
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, [brandColor]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
export default AntigravityHeroField;
