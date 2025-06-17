import React from 'react';

export default function DashboardBlock({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="bg-white border rounded shadow p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}
