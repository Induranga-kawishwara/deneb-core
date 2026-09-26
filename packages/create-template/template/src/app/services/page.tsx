'use client';

import { contentList, contentObject, contentText, useServices, useSiteData } from '@/lib/siteDataContext';
import { EditableSection, EditableCard, EditableImage, EditableText } from '@deneb-ui/ui';

export default function ServicesPage() {
  const siteData = useSiteData();
  const content = contentObject(siteData.content);
  const page = contentObject(content.servicesPage);
  const services = useServices();

  return (
    <div data-preview-page-key="services" style={{ display: 'flex', flexDirection: 'column' }}>
      <EditableSection
        name="services-heading"
        order={siteData?.styles?.['services-heading.section']?.order ?? 1}
        centered={siteData?.styles?.['services-heading.section']?.centered ?? false}
        hidden={siteData?.styles?.['services-heading.section']?.hidden ?? false}
        className="page-section page-heading"
      >
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
      </EditableSection>
      <EditableSection
        name="services-list"
        order={siteData?.styles?.['services-list.section']?.order ?? 2}
        centered={siteData?.styles?.['services-list.section']?.centered ?? false}
        hidden={siteData?.styles?.['services-list.section']?.hidden ?? false}
        className="page-section alt"
      >
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
              </EditableCard>
            );
          })}
        </div>
      </EditableSection>
    </div>
  );
}
