'use client';

import { ReactNode, useEffect } from 'react';
import { isValidElement } from 'react';

type Props = {
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
};

export default function SafeTriggerButton({
  onClick,
  children,
  className = '',
  title,
}: Props) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const containsButton = checkForButton(children);
      if (containsButton) {
        console.warn(
          '🚨 <SafeTriggerButton> received a <button> element as a child — this may cause hydration errors. Use <div> or <span> instead.'
        );
      }
    }
  }, [children]);

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

// 🔍 Recursive check for <button> in React children tree
function checkForButton(child: ReactNode): boolean {
  if (!child) return false;
  if (Array.isArray(child)) {
    return child.some(checkForButton);
  }
  if (isValidElement(child)) {
    if (typeof child.type === 'string' && child.type === 'button') {
      return true;
    }
    return checkForButton((child as any).props?.children);
  }
  return false;
}
