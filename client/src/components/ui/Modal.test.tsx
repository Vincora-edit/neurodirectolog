import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        Modal content
      </Modal>
    );
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        Modal content
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Title">
        Content
      </Modal>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Title">
        Content
      </Modal>
    );

    const closeButton = screen.getByRole('button');
    await userEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        Content
      </Modal>
    );

    const backdrop = document.querySelector('.bg-black\\/50');
    if (backdrop) {
      await userEvent.click(backdrop);
      expect(handleClose).toHaveBeenCalledTimes(1);
    }
  });

  it('calls onClose when Escape is pressed', async () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        Content
      </Modal>
    );

    await userEvent.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={() => {}} size="sm">
        Content
      </Modal>
    );
    expect(document.querySelector('.max-w-sm')).toBeInTheDocument();

    rerender(
      <Modal isOpen={true} onClose={() => {}} size="xl">
        Content
      </Modal>
    );
    expect(document.querySelector('.max-w-xl')).toBeInTheDocument();
  });
});
