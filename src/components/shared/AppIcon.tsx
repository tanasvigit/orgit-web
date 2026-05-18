import React from 'react';
import { APP_ICON_SRC, type AppIconName } from '../../constants/appIcons';

export type AppIconVariant = 'nav' | 'card' | 'inline';

/** Balanced medium sizes — not tiny, not oversized. */
const VARIANT_PX: Record<AppIconVariant, number> = {
  nav: 24,
  card: 28,
  inline: 22,
};

export interface AppIconProps {
  name: AppIconName;
  className?: string;
  /** Explicit pixel size; overrides `variant` when set. */
  size?: number | string;
  variant?: AppIconVariant;
  alt?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  className = '',
  size,
  variant,
  alt = '',
}) => {
  const px =
    size !== undefined
      ? size
      : variant
        ? VARIANT_PX[variant]
        : VARIANT_PX.nav;

  return (
    <img
      src={APP_ICON_SRC[name]}
      alt={alt}
      width={px}
      height={px}
      className={`inline-block shrink-0 object-contain object-center ${className}`}
      style={{ width: px, height: px, minWidth: px, minHeight: px }}
      aria-hidden={alt ? undefined : true}
      draggable={false}
    />
  );
};
