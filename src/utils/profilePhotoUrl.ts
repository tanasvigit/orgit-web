import { getBackendBaseUrl } from '@/config/env';

/** Turn relative or S3-key profile URLs into absolute URLs for img/Image sources. */
export function resolveProfilePhotoUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  const base = getBackendBaseUrl().replace(/\/+$/, '');
  if (trimmed.startsWith('/')) {
    return base ? `${base}${trimmed}` : trimmed;
  }
  return base ? `${base}/${trimmed}` : trimmed;
}

export function getAvatarUrl(user?: Record<string, unknown> | null): string | null {
  if (!user) return null;
  const raw =
    (user.profile_photo_url as string | undefined) ||
    (user.profile_photo as string | undefined) ||
    (user.profilePhotoUrl as string | undefined) ||
    (user.photoUrl as string | undefined);
  if (!raw || typeof raw !== 'string') return null;
  return resolveProfilePhotoUrl(raw);
}
