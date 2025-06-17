import React from 'react';

export function MissingLink({
  type,
  className,
  ...rest
}: {
  type: 'template' | 'snapshot';
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`${className} tooltip opacity-60 cursor-not-allowed border rounded px-2 py-1 ${type === 'template' ? 'bg-blue-950' : 'bg-indigo-950'}`}
      role="note"
      title={`Missing ${type} ID`}
      {...rest}
      onClick={(e) => {
        e.preventDefault();
        console.warn(
          `SmartLink: attempted to render ${type} link with missing ID`
        );
      }}
    >
      Invalid {type}
    </div>
  );
}
