import type { ReactNode } from 'react';
import { cn } from '../../utils/helpers';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className,
  padding = 'md',
  hover = false,
  onClick,
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-sm',
        paddingClasses[padding],
        hover && 'hover:shadow-md transition-shadow cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function CardHeader({ children, className, actions }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div className="flex items-center gap-2">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function CardTitle({ children, className, icon }: CardTitleProps) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900 flex items-center gap-2', className)}>
      {icon}
      {children}
    </h3>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn('', className)}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-gray-100', className)}>
      {children}
    </div>
  );
}
