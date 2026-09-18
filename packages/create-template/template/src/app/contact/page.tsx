'use client';

import { useState, type FormEvent } from 'react';
import { EditableText, EditableBox } from '@deneb-ui/ui';
import { contentObject, contentText, useSiteData } from '@/lib/siteDataContext';

export default function ContactPage() {
  const siteData = useSiteData();
  const contact = contentObject(contentObject(siteData.content).contact);
  const [status, setStatus] = useState('');

  const directionsLabel = contentText(contact.directionsLabel) || 'Get Directions';
  const directionsUrl =
    contentText(contact.directionsUrl) ||
    contentText(contact.mapUrl) ||
    contentText(contact.addressUrl);
  const address = contentText(contact.address);
  const phone = contentText(contact.phone);
  const email = contentText(contact.email);
  const whatsapp = contentText(contact.whatsapp);
  const directMessageText = contentText(contact.directMessageText) || 'Chat on WhatsApp';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const projectId = siteData.project?.id?.trim();
    if (!projectId) {
      setStatus('This website is not connected to a published project yet.');
      return;
    }

    const formData = new FormData(form);
    setStatus('Sending your message...');
    try {
      const response = await fetch('/site-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: String(formData.get('name') ?? ''),
          email: String(formData.get('email') ?? ''),
          message: String(formData.get('message') ?? ''),
        }),
      });
      if (!response.ok) throw new Error('Unable to send message.');
      form.reset();
      setStatus('Thanks — your message has been sent successfully.');
    } catch {
      setStatus('We could not send your message right now. Please try again later.');
    }
  }

  return (
    <div data-preview-page-key="contact">
      <section className="page-section page-heading" data-design-section="contact-heading">
        <EditableText
          variant="h1"
          size="4xl"
          weight="bold"
          color="heading"
          data-preview-field-path="contact.heading"
          defaultValue={contentText(contact.heading)}
        />
        <EditableText
          variant="lead"
          color="muted"
          data-preview-field-path="contact.intro"
          defaultValue={contentText(contact.intro)}
        />
      </section>

      <section className="page-section contact-grid" data-design-section="contact-details">
        <EditableBox className="card contact-details" balance radius="xl">
          <EditableText
            variant="h3"
            size="xl"
            weight="bold"
            color="heading"
            data-preview-static="contact-heading"
            defaultValue="Direct Information"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <a href={phone ? `tel:${phone}` : ''} data-preview-field-path="contact.phone">
              {phone}
            </a>
            <a href={email ? `mailto:${email}` : ''} data-preview-field-path="contact.email">
              {email}
            </a>
            <EditableText
              variant="p"
              color="muted"
              data-preview-field-path="contact.address"
              defaultValue={address}
            />
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <a
              href={directionsUrl || '#'}
              data-preview-field-path="contact.directionsUrl"
              target="_blank"
              rel="noopener noreferrer"
              className="deneb-map-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border, #e2e8f0)',
                color: 'var(--color-text, #0f172a)',
              }}
            >
              <svg data-preview-static="map-link-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span data-preview-field-path="contact.directionsLabel">{directionsLabel}</span>
            </a>
            <a
              href={whatsapp ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary"
              data-preview-field-path="contact.whatsapp"
            >
              <span data-preview-field-path="contact.directMessageText">
                {directMessageText}
              </span>
            </a>
          </div>
        </EditableBox>

        <EditableBox className="card" balance radius="xl">
          <form
            className="contact-form"
            onSubmit={handleSubmit}
            data-fivora-contact-disabled
          >
            <EditableText
              variant="h2"
              size="2xl"
              weight="bold"
              color="heading"
              data-preview-field-path="contact.formTitle"
              defaultValue={contentText(contact.formTitle)}
            />
            <label data-preview-static>
              Name
              <input type="text" name="name" autoComplete="name" required />
            </label>
            <label data-preview-static>
              Email
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <label data-preview-static>
              Message
              <textarea name="message" rows={4} required />
            </label>
            <button type="submit" className="button-primary" style={{ marginTop: '0.5rem' }}>
              <span data-preview-field-path="contact.submitLabel">
                {contentText(contact.submitLabel)}
              </span>
            </button>
            {status && (
              <p role="status" aria-live="polite" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                {status}
              </p>
            )}
          </form>
        </EditableBox>
      </section>
    </div>
  );
}
