import React from 'react';
import { ArrowDown, Equal } from 'lucide-react';
import type { TaskPriority } from '../types.ts';

interface PriorityIconBadgeProps {
  priority?: TaskPriority | null;
  isGateBlocker?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * PriorityIconBadge
 * Matches the user-provided design: a prominent, vibrant rounded-square badge
 * showing only the priority icon (e.g. orange exclamation mark "!" for High/Urgent),
 * without any text labels.
 */
export const PriorityIconBadge: React.FC<PriorityIconBadgeProps> = ({
  priority = 'medium',
  isGateBlocker = false,
  onClick,
  className = '',
  size = 'md',
}) => {
  const effectivePriority: TaskPriority =
    priority ?? (isGateBlocker ? 'high' : 'medium');

  const sizeClasses =
    size === 'sm' ? 'w-4 h-4 rounded-[5px]' : 'w-5 h-5 rounded-[6px]';

  const iconClasses = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  // Distinct vibrant styles
  let badgeStyle = '';
  let title = '';

  if (effectivePriority === 'high' || isGateBlocker) {
    // High / Urgent: Matches the user's uploaded orange exclamation badge
    badgeStyle =
      'bg-[#FF5C00] text-white shadow-[0_1px_3px_rgba(255,92,0,0.35)]';
    title = isGateBlocker ? 'High Priority (Gate Blocker)' : 'High Priority';
  } else if (effectivePriority === 'medium') {
    // Medium: Warm amber/yellow rounded square
    badgeStyle =
      'bg-[#F59E0B] text-white shadow-[0_1px_3px_rgba(245,158,11,0.35)]';
    title = 'Medium Priority';
  } else {
    // Low: Cool blue rounded square
    badgeStyle =
      'bg-[#3B82F6] text-white shadow-[0_1px_3px_rgba(59,130,246,0.35)]';
    title = 'Low Priority';
  }

  const content = (
    <span
      className={`inline-flex items-center justify-center font-black select-none shrink-0 transition-transform active:scale-95 ${sizeClasses} ${badgeStyle} ${className}`}
      title={title}
      aria-label={title}
    >
      {effectivePriority === 'high' || isGateBlocker ? (
        <span
          className="font-black text-[12px] leading-none text-white tracking-tighter"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          !
        </span>
      ) : effectivePriority === 'medium' ? (
        <Equal className={`${iconClasses} stroke-[3] text-white`} aria-hidden="true" />
      ) : (
        <ArrowDown className={`${iconClasses} stroke-[3] text-white`} aria-hidden="true" />
      )}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${title} (click to cycle)`}
        className="focus:outline-none focus:ring-1 focus:ring-[#0A4595] rounded-[6px]"
      >
        {content}
      </button>
    );
  }

  return content;
};
