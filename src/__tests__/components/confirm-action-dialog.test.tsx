import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';

describe('ConfirmActionDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Delete Product',
    description: 'Are you sure you want to delete this product?',
    onConfirm: vi.fn(),
  };

  it('renders title and description when open=true', () => {
    render(<ConfirmActionDialog {...defaultProps} />);

    expect(screen.getByText('Delete Product')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this product?')).toBeInTheDocument();
  });

  it('does NOT render content when open=false', () => {
    render(<ConfirmActionDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Delete Product')).not.toBeInTheDocument();
    expect(screen.queryByText('Are you sure you want to delete this product?')).not.toBeInTheDocument();
  });

  it('calls onConfirm when action button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmActionDialog {...defaultProps} onConfirm={onConfirm} />);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('renders custom action label', () => {
    render(<ConfirmActionDialog {...defaultProps} actionLabel="Delete Forever" />);

    expect(screen.getByRole('button', { name: 'Delete Forever' })).toBeInTheDocument();
  });

  it('shows loading spinner when isLoading=true', () => {
    const { container } = render(
      <ConfirmActionDialog {...defaultProps} isLoading={true} />
    );

    // Lucide Loader2 renders as an SVG; the component applies 'animate-spin' via className
    // Check for the SVG element inside the confirm button
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    const svg = confirmButton.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('disables buttons when isLoading=true', () => {
    render(<ConfirmActionDialog {...defaultProps} isLoading={true} />);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('has a Cancel button', () => {
    render(<ConfirmActionDialog {...defaultProps} />);

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
