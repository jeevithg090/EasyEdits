import React, { useEffect, useState } from 'react';

/**
 * Decorative gradient backdrop. The main orb drifts slightly with the pointer
 * on devices with a fine pointer, unless the user prefers reduced motion.
 */
export const Background: React.FC = () => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const finePointer = window.matchMedia?.('(pointer: fine)').matches ?? false;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!finePointer || reducedMotion) return;

    // Re-render at most once per animation frame instead of on every mousemove.
    let frame = 0;
    const handleMouseMove = (event: MouseEvent) => {
      if (frame) return;
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setOffset({ x: clientX * 0.02, y: clientY * 0.02 });
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute h-[800px] w-[800px] rounded-full opacity-30 blur-[150px] transition-transform duration-1000"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
          transform: `translate(${offset.x}px, ${offset.y - 200}px)`,
        }}
      />
      <div
        className="absolute right-[10%] top-[30%] h-[600px] w-[600px] rounded-full opacity-20 blur-[120px]"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.5) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute bottom-[10%] left-[20%] h-[500px] w-[500px] rounded-full opacity-20 blur-[100px]"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  );
};
