import React, { useState } from 'react';
import { useSiteData } from './SiteDataProvider';
import { useWhatsAppForm } from './hooks/useWhatsAppForm';

export interface EditableContactFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  endpoint?: string;
  whatsappUrl?: string;
  whatsappUrlPath?: string;
  submitMode?: 'whatsapp' | 'api' | 'both';
  formTitle?: string;
  formTitlePath?: string;
  submitButtonText?: string;
  submitLabelPath?: string;
  nameLabelPath?: string;
  namePlaceholderPath?: string;
  emailLabelPath?: string;
  emailPlaceholderPath?: string;
  phoneLabelPath?: string;
  phonePlaceholderPath?: string;
  messageLabelPath?: string;
  messagePlaceholderPath?: string;
  successMessage?: string;
  showPhone?: boolean;
}

export function EditableContactForm({
  endpoint = 'https://api.fivora.com/site-contact',
  whatsappUrl,
  whatsappUrlPath = 'contact.formWhatsappUrl',
  submitMode = 'whatsapp',
  formTitle,
  formTitlePath,
  submitButtonText = 'Send Message',
  submitLabelPath = 'contact.submitLabel',
  nameLabelPath = 'contact.nameLabel',
  namePlaceholderPath = 'contact.namePlaceholder',
  emailLabelPath = 'contact.emailLabel',
  emailPlaceholderPath = 'contact.emailPlaceholder',
  phoneLabelPath = 'contact.phoneLabel',
  phonePlaceholderPath = 'contact.phonePlaceholder',
  messageLabelPath = 'contact.messageLabel',
  messagePlaceholderPath = 'contact.messagePlaceholder',
  successMessage = 'Thank you! Your message has been sent successfully.',
  showPhone = false,
  className = '',
  style,
  ...props
}: EditableContactFormProps) {
  const siteData = useSiteData();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const contactContent = (siteData?.content as Record<string, any>)?.contact as Record<string, any> | undefined;
  const resolvedSubmitText = String(contactContent?.submitLabel || submitButtonText);
  const resolvedFormTitle = formTitle || contactContent?.formTitle;
  const resolvedNameLabel = String(contactContent?.nameLabel || 'Your Name');
  const resolvedNamePlaceholder = String(contactContent?.namePlaceholder || 'John Doe');
  const resolvedEmailLabel = String(contactContent?.emailLabel || 'Email Address');
  const resolvedEmailPlaceholder = String(contactContent?.emailPlaceholder || 'john@example.com');
  const resolvedPhoneLabel = String(contactContent?.phoneLabel || 'Phone Number');
  const resolvedPhonePlaceholder = String(contactContent?.phonePlaceholder || '+1 (555) 000-0000');
  const resolvedMessageLabel = String(contactContent?.messageLabel || 'Message');
  const resolvedMessagePlaceholder = String(contactContent?.messagePlaceholder || 'Tell us how we can help...');

  const { submitViaWhatsApp, resolvedWhatsappUrl } = useWhatsAppForm({
    whatsappUrl,
    whatsappUrlPath,
    formName: resolvedFormTitle || 'Contact Form',
    onSuccess: () => {
      setStatus('success');
    },
    onError: (err) => {
      setStatus('error');
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      projectId: siteData?.project?.id || 'demo-project',
      name: formData.get('name'),
      email: formData.get('email'),
      phone: showPhone ? formData.get('phone') : undefined,
      message: formData.get('message'),
    };

    if (submitMode === 'api') {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Submission error: ${res.statusText || 'Unable to send message'}`);
        }

        setStatus('success');
        form.reset();
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'Something went wrong. Please try again.');
      }
      return;
    }

    // Default to WhatsApp dispatch (or both if requested)
    if (submitMode === 'both') {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }

    const success = submitViaWhatsApp(form);
    if (success) {
      setStatus('success');
      form.reset();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-fivora-contact-disabled
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        ...style,
      }}
      className={`editable-contact-form ${className}`.trim()}
      {...props}
    >
      {(resolvedFormTitle || formTitlePath) && (
        <h2
          className="deneb-contact-form-title"
          data-preview-field-path={formTitlePath || 'contact.formTitle'}
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--heading-color, #0f172a)',
            margin: '0 0 0.5rem 0',
          }}
        >
          {resolvedFormTitle}
        </h2>
      )}

      <div>
        <label
          htmlFor="contact-name"
          data-preview-field-path={nameLabelPath}
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 600,
            marginBottom: '0.375rem',
            color: 'var(--heading-color, #0f172a)',
          }}
        >
          {resolvedNameLabel}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          placeholder={resolvedNamePlaceholder}
          data-preview-field-path={namePlaceholderPath}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: '1px solid var(--input-border, #cbd5e1)',
            fontSize: '0.95rem',
            outline: 'none',
            backgroundColor: 'var(--input-bg, #ffffff)',
            color: 'var(--input-color, var(--page-text, inherit))',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div>
        <label
          htmlFor="contact-email"
          data-preview-field-path={emailLabelPath}
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 600,
            marginBottom: '0.375rem',
            color: 'var(--heading-color, #0f172a)',
          }}
        >
          {resolvedEmailLabel}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          placeholder={resolvedEmailPlaceholder}
          data-preview-field-path={emailPlaceholderPath}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: '1px solid var(--input-border, #cbd5e1)',
            fontSize: '0.95rem',
            outline: 'none',
            backgroundColor: 'var(--input-bg, #ffffff)',
            color: 'var(--input-color, var(--page-text, inherit))',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {showPhone && (
        <div>
          <label
            htmlFor="contact-phone"
            data-preview-field-path={phoneLabelPath}
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              marginBottom: '0.375rem',
              color: 'var(--heading-color, #0f172a)',
            }}
          >
            {resolvedPhoneLabel}
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            placeholder={resolvedPhonePlaceholder}
            data-preview-field-path={phonePlaceholderPath}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '0.95rem',
              outline: 'none',
              backgroundColor: '#ffffff',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      <div>
        <label
          htmlFor="contact-message"
          data-preview-field-path={messageLabelPath}
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 600,
            marginBottom: '0.375rem',
            color: 'var(--heading-color, #0f172a)',
          }}
        >
          {resolvedMessageLabel}
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          placeholder={resolvedMessagePlaceholder}
          data-preview-field-path={messagePlaceholderPath}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: '1px solid var(--input-border, #cbd5e1)',
            fontSize: '0.95rem',
            outline: 'none',
            backgroundColor: 'var(--input-bg, #ffffff)',
            color: 'var(--input-color, var(--page-text, inherit))',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          padding: '0.875rem 1.5rem',
          borderRadius: '10px',
          border: 'none',
          backgroundColor: 'var(--brand-color, #2563eb)',
          color: '#ffffff',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
          opacity: status === 'submitting' ? 0.7 : 1,
          boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.35)',
          transition: 'all 0.2s ease',
        }}
      >
        <span data-preview-field-path={submitLabelPath}>
          {status === 'submitting' ? 'Sending Message...' : resolvedSubmitText}
        </span>
      </button>

      <span
        hidden
        aria-hidden="true"
        data-preview-field-path={whatsappUrlPath}
      >
        {resolvedWhatsappUrl}
      </span>

      {status === 'success' && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#15803d',
            fontSize: '0.925rem',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {successMessage}
        </div>
      )}

      {status === 'error' && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#b91c1c',
            fontSize: '0.925rem',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {errorMessage}
        </div>
      )}
    </form>
  );
}
