'use client';

import { contentList, contentObject, contentText, useServices, useSiteData } from '@/lib/siteDataContext';
import { EditableCard, EditableImage, EditableText } from '@deneb-ui/ui';

export default function ServicesPage() {
  const siteData = useSiteData();
  const content = contentObject(siteData.content);
  const page = contentObject(content.servicesPage);
  const services = useServices();

  return (
    <div data-preview-page-key="services">
      <section className="page-section page-heading" data-design-section="services-heading">
        <EditableText
          as="h1"
          variant="h1"
          size="4xl"
          weight="bold"
          color="heading"
          data-preview-field-path="servicesPage.heading"
          defaultValue={contentText(page.heading)}
        />
        <EditableText
          as="p"
          variant="lead"
          color="muted"
          data-preview-field-path="servicesPage.intro"
          defaultValue={contentText(page.intro)}
        />
      </section>
      <section className="page-section alt" data-design-section="services-list">
        <div className="card-grid" data-preview-list-path="services">
          {services.map((rawService, index) => {
            const service = contentObject(rawService);
            const features = contentList(service.features);
            const imageUrl = contentText(service.imageUrl);

            return (
              <EditableCard
                key={contentText(service.id) || index}
                className="card service-card"
                item={service as any}
                itemPath={`services[${index}]`}
                data-preview-item-path={`services[${index}]`}
                balance
                radius="xl"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                {imageUrl && (
                  <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', marginBottom: '0.75rem' }}>
                    <EditableImage
                      src={imageUrl}
                      alt={contentText(service.name)}
                      data-preview-field-path={`services[${index}].imageUrl`}
                      aspectRatio="16/9"
                      fit="cover"
                      radius="lg"
                    />
                  </div>
                )}
                <EditableText
                  variant="h3"
                  size="xl"
                  weight="bold"
                  color="heading"
                  data-preview-field-path={`services[${index}].name`}
                  defaultValue={contentText(service.name)}
                />
                <EditableText
                  variant="p"
                  color="muted"
                  data-preview-field-path={`services[${index}].description`}
                  defaultValue={contentText(service.description)}
                  style={{ marginTop: '0.5rem' }}
                />
                {features.length > 0 && (
                  <ul
                    className="service-features-list"
                    data-preview-list-path={`services[${index}].features`}
                    style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingLeft: '1.25rem' }}
                  >
                    {features.map((feature, fIndex) => (
                      <li
                        key={fIndex}
                        data-preview-item-path={`services[${index}].features[${fIndex}]`}
                        style={{ fontSize: '0.875rem' }}
                      >
                        <span data-preview-field-path={`services[${index}].features[${fIndex}]`}>
                          {contentText(feature)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {(() => {
                  const itemShowPrice =
                    (service as any)?.showPrice !== undefined
                      ? Boolean((service as any).showPrice)
                      : ((service as any)?.customData?.showPrice !== undefined
                        ? Boolean((service as any).customData.showPrice)
                        : true);
                  const price = (service as any).price;
                  const priceLabel = contentText((service as any).priceLabel);
                  const hasNumericPrice = price !== undefined && price !== null && String(price).trim() !== '';
                  const formattedPrice = hasNumericPrice
                    ? typeof price === 'number'
                      ? `LKR ${price.toLocaleString()}`
                      : String(price).includes('LKR')
                        ? String(price)
                        : `LKR ${price}`
                    : '';

                  if (itemShowPrice && (hasNumericPrice || priceLabel)) {
                    return (
                      <div style={{ marginTop: 'auto', paddingTop: '0.75rem', display: 'flex', alignItems: 'baseline', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {hasNumericPrice && (
                          <EditableText
                            as="span"
                            weight="bold"
                            size="lg"
                            color="primary"
                            data-preview-field-path={`services[${index}].price`}
                            defaultValue={formattedPrice}
                          />
                        )}
                        {priceLabel && (
                          <EditableText
                            as="span"
                            color="muted"
                            data-preview-field-path={`services[${index}].priceLabel`}
                            defaultValue={priceLabel}
                            style={{ fontSize: '0.8125rem' }}
                          />
                        )}
                      </div>
                    );
                  }
                  if (!itemShowPrice) {
                    return (
                      <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--muted-text, #94a3b8)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                          }}
                        >
                          Quote on Request
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </EditableCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
