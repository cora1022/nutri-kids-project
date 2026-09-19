import type { ReactNode } from 'react';

export type CardTone = 'default' | 'muted' | 'highlight' | 'success' | 'danger';

interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  className?: string;
}

export function Card({ children, tone = 'default', className = '' }: CardProps) {
  return <div className={`card card-${tone} ${className}`}>{children}</div>;
}

interface ScreenShellProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function ScreenShell({ eyebrow, title, subtitle, headerAction, children }: ScreenShellProps) {
  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head-top">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1>{title}</h1>
          </div>
          {headerAction && <div className="screen-head-action">{headerAction}</div>}
        </div>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      <div className="screen-body">{children}</div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon = '🍱', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
