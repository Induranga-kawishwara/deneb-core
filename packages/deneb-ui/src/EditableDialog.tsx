import React, { useEffect } from 'react';
import { EditableText } from './EditableText';

export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  titleFieldPath?: string;
  descriptionFieldPath?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  footerSlot?: React.ReactNode;
}

const SIZE_MAP: Record<string, string> = {
  sm: '400px',
  md: '540px',
  lg: '720px',
  xl: '900px',
  full: '96vw',
};

/**
 * Dialog (Modal) component for DENEB UI.
 * Features backdrop blur, keyboard Escape to close, smooth scaling animation,
 * and optional live visual editing for title and description.
 */
export function EditableDialog({
  open = false,
  onClose,
  title,
  description,
  titleFieldPath,
  descriptionFieldPath,
  size = 'md',
  showCloseButton = true,
  footerSlot,
  children,
  className = '',
  style,
  ...props
}: DialogProps) {
  // Handle ESC key press to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  if (!open) return null;

  const maxWidth = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      className={`deneb-dialog-portal ${className}`.trim()}
      {...props}
    >
      {/* Backdrop overlay with blur */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'deneb-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="deneb-dialog-backdrop"
      />

      {/* Modal Dialog Content */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth,
          backgroundColor: 'var(--card-bg, var(--color-surface, #ffffff))',
          color: 'var(--page-text, inherit)',
          border: '1px solid var(--color-border, rgba(0, 0, 0, 0.05))',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          padding: '2rem',
          zIndex: 10,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'deneb-zoom-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          ...style,
        }}
        className="deneb-dialog-content"
      >
        {/* Header */}
        {(title || titleFieldPath || showCloseButton) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: description || descriptionFieldPath ? '0.5rem' : '1.25rem',
            }}
          >
            {title ? (
              <EditableText
                as="h2"
                id={titleFieldPath || 'common.dialogTitle'}
                defaultValue={title}
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: 'var(--heading-color, #0f172a)',
                  margin: 0,
                }}
              />
            ) : (
              <div />
            )}

            {showCloseButton && onClose && (
              <button
                type="button"
                data-preview-static="dialog-close-btn"
                onClick={onClose}
                aria-label="Close dialog"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.375rem',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Description */}
        {description ? (
          <EditableText
            as="p"
            id={descriptionFieldPath || 'common.dialogDescription'}
            defaultValue={description}
            style={{
              fontSize: '0.925rem',
              color: 'var(--muted-text, #64748b)',
              marginBottom: '1.5rem',
              lineHeight: 1.5,
              margin: '0 0 1.5rem 0',
            }}
          />
        ) : null}

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>

        {/* Footer */}
        {footerSlot && (
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1rem',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            {footerSlot}
          </div>
        )}
      </div>
    </div>
  );
}

// Dialog Component Primitives (shadcn/HeroUI style)
export type DialogContentProps = React.HTMLAttributes<HTMLDivElement>;
export function DialogHeader({ className = '', style, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ marginBottom: '1rem', ...style }} className={`deneb-dialog-header ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({ className = '', style, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--heading-color, #0f172a)', margin: 0, ...style }} className={`deneb-dialog-title ${className}`.trim()} {...props}>
      {children}
    </h3>
  );
}

export function DialogDescription({ className = '', style, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p style={{ fontSize: '0.9rem', color: 'var(--muted-text, #64748b)', marginTop: '0.375rem', ...style }} className={`deneb-dialog-description ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function DialogFooter({ className = '', style, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', ...style }} className={`deneb-dialog-footer ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export const Dialog = EditableDialog;
