import { useLocation, useNavigate } from 'react-router-dom';
import { RefObject } from 'react';

export interface TaskTransitionState {
  animateTaskTransition: boolean;
  taskId?: string;
  fromStatus?: string;
  toStatus?: string;
  /** Which dashboard section to animate: 'self' (Self Tasks) or 'assigned' (Assigned Tasks) */
  taskSection?: 'self' | 'assigned';
}

export interface AnimationPositions {
  source: { x: number; y: number };
  target: { x: number; y: number };
}

/**
 * Hook to detect and manage task transition animation state from location state
 */
export const useTaskTransitionAnimation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as TaskTransitionState | undefined;

  const shouldAnimate = state?.animateTaskTransition === true;
  const taskId = state?.taskId;
  const fromStatus = state?.fromStatus;
  const toStatus = state?.toStatus;
  const taskSection = state?.taskSection;

  /**
   * Get positions from refs for animation
   */
  const getPositions = (
    sourceRef: RefObject<HTMLElement>,
    targetRef: RefObject<HTMLElement>
  ): AnimationPositions | null => {
    if (!sourceRef.current || !targetRef.current) return null;

    const sourceRect = sourceRef.current.getBoundingClientRect();
    const targetRect = targetRef.current.getBoundingClientRect();

    return {
      source: {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2,
      },
      target: {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      },
    };
  };

  /**
   * Clear animation state from location
   */
  const clearAnimationState = () => {
    navigate(location.pathname, { replace: true, state: {} });
  };

  return {
    shouldAnimate,
    taskId,
    fromStatus,
    toStatus,
    taskSection,
    getPositions,
    clearAnimationState,
  };
};
