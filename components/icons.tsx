import { clsx } from '@/lib/utils';

interface PlatformIconProps {
  platform: 'youtube' | 'facebook' | 'pinterest';
  className?: string;
}

export function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
    </svg>
  );
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.5h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

export function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.02 0C5.4 0 .03 5.37.03 12c0 5.08 3.16 9.42 7.63 11.17-.11-.95-.2-2.4.04-3.44.22-.93 1.4-5.94 1.4-5.94s-.36-.72-.36-1.78c0-1.66.97-2.9 2.17-2.9 1.02 0 1.52.77 1.52 1.69 0 1.03-.65 2.57-.99 4-.28 1.2.6 2.17 1.77 2.17 2.13 0 3.76-2.25 3.76-5.49 0-2.87-2.06-4.88-5.01-4.88-3.41 0-5.42 2.56-5.42 5.21 0 1.03.4 2.14.89 2.74a.36.36 0 0 1 .08.34c-.09.38-.3 1.2-.34 1.37-.05.22-.18.27-.41.16-1.53-.71-2.49-2.94-2.49-4.74 0-3.85 2.8-7.39 8.07-7.39 4.24 0 7.53 3.02 7.53 7.05 0 4.21-2.65 7.6-6.34 7.6-1.24 0-2.4-.64-2.8-1.4l-.76 2.9c-.28 1.06-1.02 2.39-1.52 3.2 1.14.35 2.35.55 3.61.55 6.62 0 11.99-5.37 11.99-12S18.64 0 12.02 0z" />
    </svg>
  );
}

export function PlatformIcon({ platform, className }: PlatformIconProps) {
  if (platform === 'youtube') return <YouTubeIcon className={className} />;
  if (platform === 'facebook') return <FacebookIcon className={className} />;
  return <PinterestIcon className={className} />;
}
