import React, { useEffect, useState, RefObject } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { createPortal } from 'react-dom';

interface TaskTransitionAnimationProps {
  sourceRef: RefObject<HTMLElement>;
  targetRef: RefObject<HTMLElement>;
  taskId?: string;
  section?: 'self' | 'assigned';
  onComplete: () => void;
}

export const TaskTransitionAnimation: React.FC<TaskTransitionAnimationProps> = ({
  sourceRef,
  targetRef,
  taskId,
  section = 'self',
  onComplete,
}) => {
  const [positions, setPositions] = useState<{ source: { x: number; y: number }; target: { x: number; y: number } } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Motion values for animation (all hooks must be called unconditionally)
  const progress = useMotionValue(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const rotate = useMotionValue(0);
  const shadowOpacity = useMotionValue(0);
  const boxShadow = useTransform(shadowOpacity, (opacity) =>
    `0 ${4 * opacity}px ${12 * opacity}px rgba(0, 0, 0, ${0.3 * opacity})`
  );
  const backgroundColor = useTransform(progress, [0, 1], [
    'rgb(239, 246, 255)', // blue-50
    'rgb(243, 232, 255)', // purple-50
  ]);

  useEffect(() => {
    // Wait for refs to be available and calculate positions
    const calculatePositions = () => {
      if (!sourceRef.current || !targetRef.current) {
        // Retry after a short delay if refs aren't ready
        setTimeout(calculatePositions, 50);
        return;
      }

      const sourceRect = sourceRef.current.getBoundingClientRect();
      const targetRect = targetRef.current.getBoundingClientRect();

      const sourcePos = {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2,
      };

      const targetPos = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      };

      setPositions({ source: sourcePos, target: targetPos });
      setIsAnimating(true);

      // Set initial position
      x.set(sourcePos.x);
      y.set(sourcePos.y);

      // Animate progress from 0 to 1
      animate(progress, 1, {
        duration: 0.8,
        ease: [0.4, 0, 0.2, 1], // cubic-bezier easeInOut
        onComplete: () => {
          setTimeout(() => {
            onComplete();
          }, 100);
        },
      });

      // Animate scale: 1 → 1.1 → 1.0
      animate(scale, [1.1, 1.0], {
        duration: 0.8,
        ease: [0.4, 0, 0.2, 1],
        times: [0, 1],
      });

      // Animate rotation: 0 → 8deg → 0
      animate(rotate, [8, 0], {
        duration: 0.8,
        ease: [0.4, 0, 0.2, 1],
        times: [0, 1],
      });

      // Animate shadow opacity: 0 → 0.5 → 0
      animate(shadowOpacity, [0, 0.5, 0], {
        duration: 0.8,
        ease: [0.4, 0, 0.2, 1],
        times: [0, 0.5, 1],
      });
    };

    calculatePositions();
  }, [sourceRef, targetRef, progress, x, y, scale, rotate, shadowOpacity, onComplete]);

  // Calculate arc path position based on progress
  useEffect(() => {
    if (!positions) return;

    const unsubscribe = progress.on('change', (latest) => {
      const { source, target } = positions;

      // Linear interpolation for X
      const currentX = source.x + (target.x - source.x) * latest;

      // Parabolic arc for Y (rainbow shape)
      const arcHeight = 80; // pixels
      const midpointY = Math.min(source.y, target.y) - arcHeight;
      const t = latest;
      
      // Quadratic bezier curve: P(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
      // P₀ = source, P₁ = midpoint, P₂ = target
      const currentY =
        (1 - t) * (1 - t) * source.y +
        2 * (1 - t) * t * midpointY +
        t * t * target.y;

      x.set(currentX);
      y.set(currentY);
    });

    return () => unsubscribe();
  }, [positions, progress, x, y]);

  if (!positions || !isAnimating) return null;

  // Render using portal to ensure it's above all content
  const portalRoot = document.body;

  return createPortal(
    <motion.div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        x: '-50%',
        y: '-50%',
        scale,
        rotate,
        zIndex: 9999,
        pointerEvents: 'none',
        boxShadow,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Animated icon - shows target icon (pending_actions) */}
      <motion.div
        className="mb-2.5 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
        style={{ backgroundColor }}
      >
        <span className="material-symbols-outlined text-xl">pending_actions</span>
      </motion.div>
    </motion.div>,
    portalRoot
  );
};
