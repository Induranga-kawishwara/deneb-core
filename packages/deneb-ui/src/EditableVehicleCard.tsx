'use client';

/**
 * EditableVehicleCard — Deneb UI
 *
 * A generic, fully Deneb-editable vehicle / product listing card for
 * automotive dealership templates.
 *
 * Field path convention:
 *   cards.vehicles.{id}.name          — Car name
 *   cards.vehicles.{id}.meta          — "Year · Condition"
 *   cards.vehicles.{id}.details       — Variant / trim level
 *   cards.vehicles.{id}.badge         — Status label (Available / Reserved / Sold)
 *   cards.vehicles.{id}.mileage       — Mileage string (e.g. "68,500 km")
 *   cards.vehicles.{id}.fuel          — Fuel type string
 *   cards.vehicles.{id}.transmission  — Transmission string
 *   cards.vehicles.{id}.price         — Display price string (e.g. "LKR 9,450,000")
 *   photos.vehicles.{id}.image0       — Primary photo (replaced by editor)
 *
 * Usage:
 *   <EditableVehicleCard vehicleId="am-1001" href="/cars/2015-toyota-aqua-..." />
 *
 * The component reads field values from the SiteDataProvider context.
 * It renders nothing if used outside a SiteDataProvider (graceful no-op).
 */

import React from 'react';
import { useSiteData } from './SiteDataProvider';
import { EditableIcon } from './EditableIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VehicleCardFields {
  name?: string;
  meta?: string;
  details?: string;
  badge?: string;
  mileage?: string;
  fuel?: string;
  transmission?: string;
  price?: string;
}

export interface EditableVehicleCardProps {
  /** Vehicle ID — must match a key in cards.vehicles and photos.vehicles */
  vehicleId: string;
  /** Link href for the card */
  href?: string;
  /** CSS class for the outer article element */
  className?: string;
  /** Slot for the image element (usually <VehicleImage />) */
  imageSlot?: React.ReactNode;
  /** Slot for action buttons (CTA, save, compare) */
  actionsSlot?: React.ReactNode;
  /** Layout orientation */
  layout?: 'grid' | 'list';
  /** Children rendered inside the card body (fallback / extra content) */
  children?: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readField(
  content: unknown,
  vehicleId: string,
  field: string,
  fallback: string = ''
): string {
  const cards = (content as Record<string, unknown> | undefined)
    ?.cards as Record<string, unknown> | undefined;
  const vehicles = cards?.vehicles as Record<string, unknown> | undefined;
  const entry = vehicles?.[vehicleId] as Record<string, unknown> | undefined;
  const val = entry?.[field];
  return typeof val === 'string' && val ? val : fallback;
}

export function vehicleFieldPath(vehicleId: string, field: string): string {
  return `cards.vehicles.${vehicleId}.${field}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * EditableVehicleCard renders a skeleton vehicle card driven by site-data.json.
 * Templates should wrap or extend this component with their own visual design.
 *
 * Each text span has data-preview-field-path set so the Deneb Lab can edit
 * it directly.
 */
export function EditableVehicleCard({
  vehicleId,
  href,
  className,
  imageSlot,
  actionsSlot,
  layout = 'grid',
  children,
}: EditableVehicleCardProps): React.ReactElement | null {
  const siteData = useSiteData();
  if (!siteData) return null;

  const c = siteData.content;
  const name         = readField(c, vehicleId, 'name');
  const meta         = readField(c, vehicleId, 'meta');
  const details      = readField(c, vehicleId, 'details');
  const badge        = readField(c, vehicleId, 'badge');
  const mileage      = readField(c, vehicleId, 'mileage');
  const fuel         = readField(c, vehicleId, 'fuel');
  const transmission = readField(c, vehicleId, 'transmission');
  const price        = readField(c, vehicleId, 'price');

  const fp = (field: string) => vehicleFieldPath(vehicleId, field);

  return (
    <article
      className={className}
      data-layout={layout}
      data-preview-item-path={`cards.vehicles.${vehicleId}`}
    >
      {/* Image slot */}
      {imageSlot}

      {/* Badge */}
      {badge && (
        <span
          data-preview-field-path={fp('badge')}
          data-preview-style-target={fp('badge')}
          data-preview-style-type="text"
        >
          {badge}
        </span>
      )}

      {/* Body */}
      <div>
        {meta && (
          <p
            data-preview-field-path={fp('meta')}
            data-preview-style-target={fp('meta')}
            data-preview-style-type="text"
          >
            {meta}
          </p>
        )}

        {href ? (
          <a
            href={href}
            data-preview-field-path={fp('name')}
            data-preview-style-target={fp('name')}
            data-preview-style-type="text"
          >
            {name}
          </a>
        ) : (
          <span
            data-preview-field-path={fp('name')}
            data-preview-style-target={fp('name')}
            data-preview-style-type="text"
          >
            {name}
          </span>
        )}

        {details && (
          <p
            data-preview-field-path={fp('details')}
            data-preview-style-target={fp('details')}
            data-preview-style-type="text"
          >
            {details}
          </p>
        )}

        {/* Specs */}
        <ul>
          {mileage && (
            <li
              data-preview-field-path={fp('mileage')}
              data-preview-style-target={fp('mileage')}
              data-preview-style-type="text"
            >
              <EditableIcon name="gauge" fieldPath={fp('specs.mileage.icon')} size={14} style={{ marginRight: '0.25rem' }} />
              {mileage}
            </li>
          )}
          {fuel && (
            <li
              data-preview-field-path={fp('fuel')}
              data-preview-style-target={fp('fuel')}
              data-preview-style-type="text"
            >
              <EditableIcon name="fuel" fieldPath={fp('specs.fuel.icon')} size={14} style={{ marginRight: '0.25rem' }} />
              {fuel}
            </li>
          )}
          {transmission && (
            <li
              data-preview-field-path={fp('transmission')}
              data-preview-style-target={fp('transmission')}
              data-preview-style-type="text"
            >
              <EditableIcon name="settings" fieldPath={fp('specs.transmission.icon')} size={14} style={{ marginRight: '0.25rem' }} />
              {transmission}
            </li>
          )}
        </ul>

        {/* Price */}
        {price && (
          <p
            data-preview-field-path={fp('price')}
            data-preview-style-target={fp('price')}
            data-preview-style-type="text"
          >
            {price}
          </p>
        )}
      </div>

      {/* Actions slot */}
      {actionsSlot}

      {/* Extra children */}
      {children}
    </article>
  );
}

// ─── Editable Brand Card ──────────────────────────────────────────────────────

export interface EditableBrandCardProps {
  /** Make slug — must match a key in cards.brands (e.g. "toyota", "bmw") */
  makeSlug: string;
  /** Link href */
  href?: string;
  className?: string;
  /** Fallback display name when no site-data value is set */
  fallbackName?: string;
  /** Fallback count label */
  fallbackCountLabel?: string;
  children?: React.ReactNode;
}

function readBrandField(
  content: unknown,
  makeSlug: string,
  field: string,
  fallback: string = ''
): string {
  const cards = (content as Record<string, unknown> | undefined)
    ?.cards as Record<string, unknown> | undefined;
  const brands = cards?.brands as Record<string, unknown> | undefined;
  const entry = brands?.[makeSlug] as Record<string, unknown> | undefined;
  const val = entry?.[field];
  return typeof val === 'string' && val ? val : fallback;
}

/**
 * EditableBrandCard — renders a brand filter card with editable name and count.
 */
export function EditableBrandCard({
  makeSlug,
  href,
  className,
  fallbackName = '',
  fallbackCountLabel = '',
  children,
}: EditableBrandCardProps): React.ReactElement | null {
  const siteData = useSiteData();
  const c = siteData?.content;

  const displayName  = readBrandField(c, makeSlug, 'displayName', fallbackName);
  const countLabel   = readBrandField(c, makeSlug, 'countLabel', fallbackCountLabel);
  const bfp = (field: string) => `cards.brands.${makeSlug}.${field}`;

  const inner = (
    <>
      <span
        data-preview-field-path={bfp('displayName')}
        data-preview-style-target={bfp('displayName')}
        data-preview-style-type="text"
      >
        {displayName}
      </span>
      <span
        data-preview-field-path={bfp('countLabel')}
        data-preview-style-target={bfp('countLabel')}
        data-preview-style-type="text"
      >
        {countLabel}
      </span>
      {children}
    </>
  );

  if (href) {
    return <a href={href} className={className} data-preview-item-path={`cards.brands.${makeSlug}`}>{inner}</a>;
  }
  return <div className={className} data-preview-item-path={`cards.brands.${makeSlug}`}>{inner}</div>;
}

// ─── Editable Body Type Card ──────────────────────────────────────────────────

export interface EditableBodyTypeCardProps {
  /** Body type slug — must match a key in cards.bodyTypes (e.g. "hatchback", "suv") */
  typeSlug: string;
  href?: string;
  className?: string;
  fallbackName?: string;
  fallbackDescription?: string;
  imageSlot?: React.ReactNode;
  children?: React.ReactNode;
}

function readBodyTypeField(
  content: unknown,
  typeSlug: string,
  field: string,
  fallback: string = ''
): string {
  const cards = (content as Record<string, unknown> | undefined)
    ?.cards as Record<string, unknown> | undefined;
  const bodyTypes = cards?.bodyTypes as Record<string, unknown> | undefined;
  const entry = bodyTypes?.[typeSlug] as Record<string, unknown> | undefined;
  const val = entry?.[field];
  return typeof val === 'string' && val ? val : fallback;
}

/**
 * EditableBodyTypeCard — renders a body-type filter card with editable name and description.
 */
export function EditableBodyTypeCard({
  typeSlug,
  href,
  className,
  fallbackName = '',
  fallbackDescription = '',
  imageSlot,
  children,
}: EditableBodyTypeCardProps): React.ReactElement | null {
  const siteData = useSiteData();
  const c = siteData?.content;

  const displayName  = readBodyTypeField(c, typeSlug, 'displayName', fallbackName);
  const description  = readBodyTypeField(c, typeSlug, 'description', fallbackDescription);
  const tfp = (field: string) => `cards.bodyTypes.${typeSlug}.${field}`;

  const inner = (
    <>
      {imageSlot}
      <span
        data-preview-field-path={tfp('displayName')}
        data-preview-style-target={tfp('displayName')}
        data-preview-style-type="text"
      >
        {displayName}
      </span>
      {description && (
        <span
          data-preview-field-path={tfp('description')}
          data-preview-style-target={tfp('description')}
          data-preview-style-type="text"
        >
          {description}
        </span>
      )}
      {children}
    </>
  );

  if (href) {
    return <a href={href} className={className} data-preview-item-path={`cards.bodyTypes.${typeSlug}`}>{inner}</a>;
  }
  return <div className={className} data-preview-item-path={`cards.bodyTypes.${typeSlug}`}>{inner}</div>;
}

// ─── Editable Showroom Card ───────────────────────────────────────────────────

export interface EditableShowroomCardProps {
  showroomId: string;
  fallbackName?: string;
  fallbackAddress?: string;
  fallbackNotes?: string;
  className?: string;
  children?: React.ReactNode;
}

function readShowroomField(
  content: unknown,
  id: string,
  field: string,
  fallback: string = ''
): string {
  const showrooms = (content as Record<string, unknown> | undefined)
    ?.showrooms as Record<string, unknown> | undefined;
  const entry = showrooms?.[id] as Record<string, unknown> | undefined;
  const val = entry?.[field];
  return typeof val === 'string' && val ? val : fallback;
}

/**
 * EditableShowroomCard — renders showroom name, address, and notes
 * with data-preview-field-path attributes for Deneb Lab editing.
 */
export function EditableShowroomCard({
  showroomId,
  fallbackName = '',
  fallbackAddress = '',
  fallbackNotes = '',
  className,
  children,
}: EditableShowroomCardProps): React.ReactElement | null {
  const siteData = useSiteData();
  const c = siteData?.content;

  const name    = readShowroomField(c, showroomId, 'name', fallbackName);
  const address = readShowroomField(c, showroomId, 'address', fallbackAddress);
  const notes   = readShowroomField(c, showroomId, 'notes', fallbackNotes);
  const sfp = (field: string) => `showrooms.${showroomId}.${field}`;

  return (
    <div className={className} data-preview-item-path={`showrooms.${showroomId}`}>
      <span
        data-preview-field-path={sfp('name')}
        data-preview-style-target={sfp('name')}
        data-preview-style-type="text"
      >
        {name}
      </span>
      <address
        data-preview-field-path={sfp('address')}
        data-preview-style-target={sfp('address')}
        data-preview-style-type="text"
      >
        {address}
      </address>
      {notes && (
        <p
          data-preview-field-path={sfp('notes')}
          data-preview-style-target={sfp('notes')}
          data-preview-style-type="text"
        >
          {notes}
        </p>
      )}
      {children}
    </div>
  );
}

// ─── Helper exports ───────────────────────────────────────────────────────────

export {
  readField as readVehicleCardField,
  readBrandField,
  readBodyTypeField,
  readShowroomField,
};
