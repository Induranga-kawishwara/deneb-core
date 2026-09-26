import React, { useState } from 'react';
import { EditableText } from './EditableText';

export interface FAQItem {
  id?: string | number;
  question?: string;
  answer?: string;
  [key: string]: unknown;
}

export interface EditableFAQItemProps extends React.HTMLAttributes<HTMLElement> {
  itemPath: string;
  item: FAQItem;
  defaultOpen?: boolean;
}

export function EditableFAQItem({
  itemPath,
  item,
  defaultOpen = true,
  className = '',
  style,
  ...props
}: EditableFAQItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const question = String(item?.question || 'Frequently Asked Question?');
  const answer = String(item?.answer || 'Detailed answer explaining the details clearly.');

  return (
    <div
      data-preview-item-path={itemPath}
      style={{
        borderBottom: '1px solid #e2e8f0',
        padding: '1.25rem 0',
        ...style,
      }}
      className={`editable-faq-item ${className}`.trim()}
      {...(props as any)}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <EditableText
          as="h4"
          id={`${itemPath}.question`}
          defaultValue={question}
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--heading-color, #0f172a)',
            paddingRight: '1rem',
          }}
        />

        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            backgroundColor: isOpen ? 'var(--brand-color, #2563eb)' : '#f1f5f9',
            color: isOpen ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'transform 0.25s ease, background-color 0.25s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-preview-static="faq-chevron"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      <div
        style={{
          marginTop: '0.875rem',
          paddingRight: '2rem',
          maxHeight: isOpen ? '1000px' : '0px',
          overflow: 'hidden',
          opacity: isOpen ? 1 : 0.01,
          transition: 'all 0.25s ease',
        }}
      >
        <EditableText
          as="p"
          id={`${itemPath}.answer`}
          defaultValue={answer}
          style={{
            fontSize: '0.95rem',
            color: 'var(--muted-text, #64748b)',
            lineHeight: 1.6,
          }}
        />
      </div>
    </div>
  );
}

export interface EditableFAQAccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  listPath?: string;
  items?: FAQItem[];
  faqs?: FAQItem[];
  defaultOpenIndex?: number;
}

export function EditableFAQAccordion({
  listPath = 'home.faq',
  items: itemsProp,
  faqs,

  defaultOpenIndex = 0,
  className = '',
  style,
  ...props
}: EditableFAQAccordionProps) {
  const items = faqs || itemsProp || [];
  return (
    <div
      data-preview-list-path={listPath}
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        ...style,
      }}
      className={`editable-faq-accordion ${className}`.trim()}
      {...props}
    >
      {items.map((item, idx) => (
        <EditableFAQItem
          key={item.id || idx}
          itemPath={`${listPath}[${idx}]`}
          item={item}
          defaultOpen={idx === defaultOpenIndex}
        />
      ))}
    </div>
  );
}
