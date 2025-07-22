'use client';

import { ReactNode } from 'react';

type Props = {
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
};

export default function SafeTriggerButton({ onClick, children, className = '', title }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      title={title}
      className={`cursor-pointer focus:outline-none ${className}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </div>
  );
}
