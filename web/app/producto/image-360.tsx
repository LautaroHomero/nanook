"use client";

import React, { useRef, useState, useEffect } from 'react';

export default function Image360({ images, autoplay = true, speed = 0.4 }: { images: string[]; autoplay?: boolean; speed?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(0); // fractional position across images
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoplay && (images?.length || 0) > 1);
  const draggingRef = useRef(false);
  const startPosRef = useRef(0);

  useEffect(() => {
    posRef.current = index;
  }, [index]);

  useEffect(() => {
    function tick(now: number) {
      if (lastRef.current == null) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (isPlaying && !draggingRef.current && images.length > 1) {
        // advance fractional position based on speed (rotations per second)
        posRef.current += dt * speed * images.length;
        const newIndex = Math.floor(posRef.current) % images.length;
        setIndex(((newIndex % images.length) + images.length) % images.length);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, images.length, speed]);

  function clampIndex(i: number) {
    if (!images || images.length === 0) return 0;
    return ((Math.floor(i) % images.length) + images.length) % images.length;
  }

  function onPointerDown(e: React.PointerEvent) {
    const el = containerRef.current;
    if (!el) return;
    draggingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    startPosRef.current = posRef.current - (x / rect.width) * images.length;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = (x / rect.width) * images.length;
    posRef.current = startPosRef.current + frac;
    setIndex(clampIndex(Math.floor(posRef.current)));
  }

  function onPointerUp(e: React.PointerEvent) {
    draggingRef.current = false;
    // keep autoplay running continuously
    setIsPlaying(true);
  }

  const img = images[clampIndex(index)] || images[0];
  const isSinglePng = images.length === 1 && /\.png$/i.test(img);
  const [animT, setAnimT] = useState(0);

  useEffect(() => {
    if (!isSinglePng) return;
    let mounted = true;
    let start = performance.now();
    function loop(now: number) {
      if (!mounted) return;
      const t = (now - start) / 1000;
      setAnimT(t);
      requestAnimationFrame(loop);
    }
    const id = requestAnimationFrame(loop);
    return () => { mounted = false; cancelAnimationFrame(id); };
  }, [isSinglePng]);

  return (
    <div style={( { maxWidth: 640, margin: '0 auto 20px', position: 'relative', background: 'var(--bg)', borderRadius: 12, padding: 6 } as any)}>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={( { touchAction: 'none', cursor: draggingRef.current ? 'grabbing' : 'grab', borderRadius: 12, overflow: 'hidden' } as any)}
      >
        <img
          src={img}
          alt={`producto ${index + 1}`}
          style={( {
            width: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            ...(isSinglePng ? {} : { background: 'var(--bg)' }),
            userSelect: 'none',
            transition: draggingRef.current ? 'none' : 'transform 120ms linear',
            transform: isSinglePng
              ? `translateY(${Math.sin(animT) * 6}px) rotateY(${Math.sin(animT * 0.6) * 8}deg)`
              : `rotateY(${(index / Math.max(1, images.length - 1) - 0.5) * 12}deg)`,
          } as any)}
          draggable={false}
        />
      </div>

      <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => setIsPlaying((p) => !p)} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
          {isPlaying ? 'Pausa' : 'Play'}
        </button>
      </div>

      {images.length > 1 && (
        <div style={{ textAlign: 'center', marginTop: 8, color: 'var(--text-dim)' }}>{clampIndex(index) + 1} / {images.length}</div>
      )}
    </div>
  );
}
