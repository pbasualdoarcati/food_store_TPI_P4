import type { HTMLAttributes } from 'react';

function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
