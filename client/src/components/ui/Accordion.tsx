import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../utils/helpers';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  className?: string;
  headerClassName?: string;
  badge?: ReactNode;
}

export function Accordion({
  title,
  children,
  defaultOpen = false,
  icon,
  className,
  headerClassName,
  badge,
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('border border-gray-200 rounded-lg', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left',
          'hover:bg-gray-50 transition-colors rounded-t-lg',
          !isOpen && 'rounded-b-lg',
          headerClassName
        )}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-gray-900">{title}</span>
          {badge}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 py-3 border-t border-gray-200">{children}</div>
      )}
    </div>
  );
}

interface AccordionGroupProps {
  children: ReactNode;
  className?: string;
}

export function AccordionGroup({ children, className }: AccordionGroupProps) {
  return <div className={cn('space-y-2', className)}>{children}</div>;
}
