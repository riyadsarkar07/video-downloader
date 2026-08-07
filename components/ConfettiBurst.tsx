'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#6366f1', '#22d3ee', '#ec4899', '#f59e0b', '#34d399', '#a855f7'];

interface Piece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  width: number;
  height: number;
  drift: number;
}

export function ConfettiBurst() {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: 36 }, (_, index) => ({
        left: 6 + Math.random() * 88,
        delay: Math.random() * 0.2,
        duration: 0.9 + Math.random() * 0.9,
        color: COLORS[index % COLORS.length],
        rotate: 180 + Math.random() * 540,
        width: 5 + Math.random() * 6,
        height: 3 + Math.random() * 4,
        drift: -90 + Math.random() * 180,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {pieces.map((piece, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 1, y: -8, x: 0, rotate: 0, scale: 1 }}
          animate={{
            opacity: 0,
            y: 320,
            x: piece.drift,
            rotate: piece.rotate,
            scale: 0.55,
          }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeOut' }}
          className="absolute"
          style={{
            left: `${piece.left}%`,
            top: 0,
            width: piece.width,
            height: piece.height,
            borderRadius: 2,
            backgroundColor: piece.color,
          }}
        />
      ))}
    </div>
  );
}
