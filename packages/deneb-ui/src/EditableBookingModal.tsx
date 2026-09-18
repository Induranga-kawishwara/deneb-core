'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EditableText } from './EditableText';
import { useSiteData } from './SiteDataProvider';

export interface ServiceOption {
  id: string | number;
  name: string;
  duration?: string;
  price?: string;
}

export interface EditableBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleId?: string;
  defaultTitle?: string;
  subtitleId?: string;
  defaultSubtitle?: string;
  buttonLabelId?: string;
  defaultButtonLabel?: string;
  services?: ServiceOption[];
  whatsappNumber?: string;
  onSubmitBooking?: (details: {
    service: string;
    date: string;
    time: string;
    name: string;
    phone: string;
    notes?: string;
  }) => void;
}

export function EditableBookingModal({
  isOpen,
  onClose,
  titleId = 'common.booking.title',
  defaultTitle = 'Book Your Appointment',
  subtitleId = 'common.booking.subtitle',
  defaultSubtitle = 'Select your desired service, date, and time. We will confirm instantly via WhatsApp.',
  buttonLabelId = 'common.booking.buttonLabel',
  defaultButtonLabel = 'Confirm & Book via WhatsApp',
  services = [
    { id: '1', name: 'Signature Haircut & Style', duration: '45 mins', price: '$65' },
    { id: '2', name: 'Bespoke Balayage & Gloss', duration: '120 mins', price: '$180' },
    { id: '3', name: 'Scalp Detox & Deep Conditioning', duration: '40 mins', price: '$55' },
    { id: '4', name: 'Executive Beard Sculpt & Hot Towel', duration: '30 mins', price: '$40' },
  ],
  whatsappNumber,
  onSubmitBooking,
}: EditableBookingModalProps) {
  const siteData = useSiteData();
  const rawBusiness = (siteData?.content as Record<string, any>)?.common?.business;
  const targetWhatsapp = whatsappNumber || rawBusiness?.whatsapp || rawBusiness?.phone || '1234567890';

  const [selectedService, setSelectedService] = useState(services[0]?.name || '');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const timeSlots = [
    '09:00 AM',
    '10:00 AM',
    '11:30 AM',
    '01:00 PM',
    '02:30 PM',
    '04:00 PM',
    '05:30 PM',
  ];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmitBooking) {
      onSubmitBooking({
        service: selectedService,
        date: selectedDate,
        time: selectedTime,
        name: customerName,
        phone: customerPhone,
        notes: customerNotes,
      });
    }

    const cleanNumber = String(targetWhatsapp).replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
      `Hello! I would like to book an appointment:\n\n` +
      `• Service: ${selectedService}\n` +
      `• Date: ${selectedDate || 'Upcoming Available Date'}\n` +
      `• Time: ${selectedTime}\n` +
      `• Name: ${customerName}\n` +
      `• Phone: ${customerPhone}\n` +
      (customerNotes ? `• Notes: ${customerNotes}\n` : '')
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          color: 'var(--color-text, #1e293b)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '2rem',
          position: 'relative',
          border: '1px solid var(--color-border, #e2e8f0)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close booking modal"
          data-preview-static="modal-close-button"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '9999px',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem', paddingRight: '2rem' }}>
          <EditableText
            id={titleId}
            defaultValue={defaultTitle}
            as="h2"
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              marginBottom: '0.5rem',
              color: 'var(--color-text, #0f172a)',
            }}
          />
          <EditableText
            id={subtitleId}
            defaultValue={defaultSubtitle}
            as="p"
            style={{
              fontSize: '0.875rem',
              color: '#64748b',
              lineHeight: 1.5,
            }}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Service Selection */}
          <div>
            <label
              data-preview-static="service-label"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}
            >
              Select Service
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                outline: 'none',
              }}
            >
              {services.map((svc) => (
                <option key={svc.id} value={svc.name}>
                  {svc.name} {svc.duration ? `(${svc.duration})` : ''} {svc.price ? `— ${svc.price}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date and Time Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label
                data-preview-static="date-label"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}
              >
                Date
              </label>
              <input
                type="date"
                required
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                data-preview-static="time-label"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}
              >
                Preferred Time
              </label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                {timeSlots.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Name & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label
                data-preview-static="name-label"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}
              >
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Jane Doe"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                data-preview-static="phone-label"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}
              >
                Phone / WhatsApp
              </label>
              <input
                type="tel"
                required
                placeholder="+1 (555) 000-0000"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Special Requests / Notes */}
          <div>
            <label
              data-preview-static="notes-label"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}
            >
              Special Notes / Requests (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any hair preferences, color history, or styling goals..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Action Submit Button */}
          <button
            type="submit"
            style={{
              marginTop: '0.5rem',
              padding: '0.95rem 1.5rem',
              borderRadius: '14px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '1rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.625rem',
              transition: 'background-color 0.2s ease, transform 0.1s ease',
              boxShadow: '0 10px 15px -3px rgba(22, 163, 74, 0.3)',
            }}
          >
            {/* WhatsApp Icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              data-preview-static="whatsapp-icon"
            >
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.071.376-.043.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z" />
            </svg>
            <EditableText id={buttonLabelId} defaultValue={defaultButtonLabel} as="span" />
          </button>
        </form>
      </div>
    </div>
  );
}

export const BookingModal = EditableBookingModal;
