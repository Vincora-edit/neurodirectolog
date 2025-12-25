import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('applies default variant classes', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('applies success variant classes', () => {
    render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success')).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('applies warning variant classes', () => {
    render(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText('Warning')).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('applies danger variant classes', () => {
    render(<Badge variant="danger">Danger</Badge>);
    expect(screen.getByText('Danger')).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('applies info variant classes', () => {
    render(<Badge variant="info">Info</Badge>);
    expect(screen.getByText('Info')).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('applies sm size classes', () => {
    render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText('Small')).toHaveClass('px-2', 'py-0.5', 'text-xs');
  });

  it('applies md size classes', () => {
    render(<Badge size="md">Medium</Badge>);
    expect(screen.getByText('Medium')).toHaveClass('px-2.5', 'py-1', 'text-sm');
  });

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    expect(screen.getByText('Custom')).toHaveClass('custom-class');
  });
});
