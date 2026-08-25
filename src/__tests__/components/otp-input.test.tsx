import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OtpInput } from '@/components/auth/otp-input';

/**
 * The component is controlled, so every test drives it through a parent that
 * actually holds the value — testing it with a static `value` would assert on
 * a field that can never change, which is not the thing users interact with.
 */
function Harness({ onComplete }: { onComplete?: (code: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <>
      <OtpInput value={value} onChange={setValue} onComplete={onComplete} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const boxes = () => screen.getAllByRole('textbox') as HTMLInputElement[];
const current = () => screen.getByTestId('value').textContent;

describe('OtpInput', () => {
  it('renders six boxes', () => {
    render(<Harness />);
    expect(boxes()).toHaveLength(6);
  });

  it('offers the first box to autofill as a one-time code', () => {
    // What lets iOS and Android surface the code from the notification.
    // Repeating it on every box makes some Androids scatter one digit each.
    render(<Harness />);
    expect(boxes()[0]).toHaveAttribute('autocomplete', 'one-time-code');
    expect(boxes()[1]).toHaveAttribute('autocomplete', 'off');
  });

  it('asks for a numeric keypad on mobile', () => {
    render(<Harness />);
    expect(boxes()[0]).toHaveAttribute('inputmode', 'numeric');
  });

  it('collects digits typed one box at a time', () => {
    render(<Harness />);
    const b = boxes();
    ['1', '2', '3', '4', '5', '6'].forEach((d, i) =>
      fireEvent.change(b[i], { target: { value: d } }),
    );
    expect(current()).toBe('123456');
  });

  it('ignores non-numeric keystrokes', () => {
    render(<Harness />);
    fireEvent.change(boxes()[0], { target: { value: 'a' } });
    expect(current()).toBe('');
  });

  it('spreads a burst of digits forward instead of keeping only the first', () => {
    // A fast typist, or an autofill, can land several digits in one box.
    render(<Harness />);
    fireEvent.change(boxes()[0], { target: { value: '123' } });
    expect(current()).toBe('123');
  });

  it('fills the whole field from a paste', () => {
    render(<Harness />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '123456' } });
    expect(current()).toBe('123456');
  });

  it('strips the spacing mail clients add to a pasted code', () => {
    render(<Harness />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '123 456' } });
    expect(current()).toBe('123456');
  });

  it('drops anything past the sixth digit on paste', () => {
    render(<Harness />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '1234567890' } });
    expect(current()).toBe('123456');
  });

  it('clears the current digit on backspace', () => {
    render(<Harness />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '123' } });
    fireEvent.keyDown(boxes()[2], { key: 'Backspace' });
    expect(current()).toBe('12');
  });

  it('steps back from an empty box rather than doing nothing', () => {
    // Without this, backspacing at the edge of the typed run feels stuck.
    render(<Harness />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '12' } });
    fireEvent.keyDown(boxes()[2], { key: 'Backspace' });
    expect(current()).toBe('1');
  });

  it('does nothing on backspace in the first empty box', () => {
    render(<Harness />);
    fireEvent.keyDown(boxes()[0], { key: 'Backspace' });
    expect(current()).toBe('');
  });

  it('fires onComplete once the sixth digit lands', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '123456' } });
    expect(onComplete).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not fire onComplete twice for the same code', () => {
    // The parent submits on this callback, and the re-render that follows
    // would otherwise submit again.
    const onComplete = vi.fn();
    const { rerender } = render(<Harness onComplete={onComplete} />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '123456' } });
    rerender(<Harness onComplete={onComplete} />);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('stays quiet until the code is complete', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '12345' } });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('labels each box for screen readers', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Digit 1 of 6')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 6 of 6')).toBeInTheDocument();
  });
});
