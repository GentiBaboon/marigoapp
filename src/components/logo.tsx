import Image, { type ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

type LogoSize = 'sm' | 'md' | 'lg';

// Widths are derived from logo.png's intrinsic 2000x535. Declaring a different
// ratio makes Next warn that only one of width/height was modified.
const SIZES: Record<LogoSize, { className: string; width: number; height: number }> = {
  sm: { className: 'h-6 w-auto', width: 90, height: 24 },
  md: { className: 'h-7 w-auto', width: 105, height: 28 },
  lg: { className: 'h-10 w-auto', width: 150, height: 40 },
};

interface LogoProps extends Omit<ImageProps, 'src' | 'alt' | 'width' | 'height'> {
  size?: LogoSize;
  /** If true, inverts the logo to white (use on dark backgrounds). */
  invert?: boolean;
}

export function Logo({ size = 'md', invert = false, className, priority, ...rest }: LogoProps) {
  const { className: sizeClass, width, height } = SIZES[size];
  return (
    <Image
      src="/logo.png"
      alt="Marigo"
      width={width}
      height={height}
      priority={priority}
      className={cn(sizeClass, invert ? 'brightness-0 invert' : 'brightness-0', className)}
      {...rest}
    />
  );
}
