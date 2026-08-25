'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Six single-character boxes that behave like one field.
 *
 * Hand-rolled rather than pulling in `input-otp`: it is one controlled string
 * and a keydown handler, and this codebase already declines dependencies that
 * earn that little (the SendGrid transport is raw `fetch` for the same reason).
 *
 * The behaviours that matter, none of which a row of plain inputs gives you:
 *  - `autoComplete="one-time-code"` on the first box, which is what lets iOS
 *    and Android offer the code straight from the notification.
 *  - Paste anywhere fills the whole field; mail clients hand over "123 456"
 *    and Gmail sometimes appends a trailing space, so non-digits are stripped.
 *  - Backspace in an empty box steps back and clears the previous one, rather
 *    than doing nothing and feeling stuck.
 *  - `text-lg` is above the 16px floor: iOS Safari zooms the page on focus
 *    below that (CLAUDE.md §13) and the boxes would slide off-centre.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  autoFocus,
  'aria-label': ariaLabel = 'Verification code',
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  'aria-label'?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  // Guards `onComplete` against firing twice for the same six digits — the
  // parent submits on it, and a re-render from that submit would otherwise
  // re-fire it.
  const fired = useRef<string | null>(null);

  const digits = value.slice(0, length).split('');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (value.length === length && fired.current !== value) {
      fired.current = value;
      onComplete?.(value);
    }
    if (value.length < length) fired.current = null;
  }, [value, length, onComplete]);

  return (
    <div className="flex items-center justify-center gap-2" role="group" aria-label={ariaLabel}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          // Only the first box advertises one-time-code. Repeating it on every
          // box makes autofill scatter one digit per field on some Androids.
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of ${length}`}
          value={digits[i] ?? ''}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D+/g, '');
            if (!typed) return;
            // A fast typist (or an autofill) can drop several digits into one
            // box; spread them forward instead of keeping only the first.
            const merged = (value.slice(0, i) + typed).slice(0, length);
            onChange(merged);
            refs.current[Math.min(merged.length, length - 1)]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (digits[i]) {
                // Truncating from here rather than blanking one box keeps the
                // code left-packed; a gap in the middle has no meaning and
                // makes the next keystroke land somewhere unexpected.
                onChange(value.slice(0, i));
              } else if (i > 0) {
                onChange(value.slice(0, i - 1));
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === 'ArrowLeft' && i > 0) {
              e.preventDefault();
              refs.current[i - 1]?.focus();
            } else if (e.key === 'ArrowRight' && i < length - 1) {
              e.preventDefault();
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D+/g, '').slice(0, length);
            if (!pasted) return;
            onChange(pasted);
            refs.current[Math.min(pasted.length, length - 1)]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-14 w-11 rounded-md border border-input bg-background text-center text-lg font-semibold',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
      ))}
    </div>
  );
}
