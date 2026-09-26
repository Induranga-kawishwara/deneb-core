'use client';

import { EditableSection, EditableText, EditableImage } from '@deneb-ui/ui';
import { contentObject, contentText, contentList, useSiteData } from '@/lib/siteDataContext';

export default function AboutPage() {
  const siteData = useSiteData();
  const about = contentObject(contentObject(siteData.content).about);
  const collageImages = contentList(about.collageImages) as Array<{ id?: string; image?: string; caption?: string }>;

  return (
    <div data-preview-page-key="about_us" style={{ display: 'flex', flexDirection: 'column' }}>
      <EditableSection
        name="about"
        order={siteData?.styles?.['about.section']?.order ?? 1}
        centered={siteData?.styles?.['about.section']?.centered ?? false}
        hidden={siteData?.styles?.['about.section']?.hidden ?? false}
        className="page-section split"
      >
        <div className="split-copy">
          <EditableText
            variant="h1"
            size="4xl"
            weight="bold"
            color="heading"
            className="section-title"
            data-preview-field-path="about.heading"
            defaultValue={contentText(about.heading)}
          />
          <EditableText
            variant="lead"
            color="muted"
            data-preview-field-path="about.body"
            defaultValue={contentText(about.body)}
          />
        </div>
        <EditableImage
          className="split-image"
          src={contentText(about.imageUrl) || '/placeholder.svg'}
          alt="About DENEB-UI"
          data-preview-field-path="about.imageUrl"
          radius="xl"
          fit="cover"
        />
      </EditableSection>

      <EditableSection
        name="about-heritage"
        order={siteData?.styles?.['about-heritage.section']?.order ?? 2}
        centered={siteData?.styles?.['about-heritage.section']?.centered ?? false}
        hidden={siteData?.styles?.['about-heritage.section']?.hidden ?? false}
        className="page-section"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'start' }}>
          <div>
            <EditableText
              variant="h2"
              size="2xl"
              weight="bold"
              color="heading"
              data-preview-field-path="about.collageHeading"
              defaultValue={contentText(about.collageHeading)}
            />
            <EditableText
              variant="p"
              color="muted"
              data-preview-field-path="about.collageDescription"
              defaultValue={contentText(about.collageDescription)}
              style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}
            />
            <EditableText
              variant="h3"
              size="xl"
              weight="bold"
              color="heading"
              data-preview-field-path="about.historyHeading"
              defaultValue={contentText(about.historyHeading)}
            />
            <EditableText
              variant="p"
              color="muted"
              data-preview-field-path="about.history"
              defaultValue={contentText(about.history)}
              style={{ marginTop: '0.5rem' }}
            />
          </div>

          <div
            data-preview-list-path="about.collageImages"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
            }}
          >
            {collageImages.map((item, index) => (
              <figure
                key={item.id || index}
                data-preview-item-path={`about.collageImages[${index}]`}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '1rem',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  margin: 0,
                  minHeight: '140px',
                  background: 'var(--color-secondary, #f1f5f9)',
                }}
              >
                <img
                  src={item.image || '/placeholder.svg'}
                  alt={item.caption || ''}
                  data-preview-field-path={`about.collageImages[${index}].image`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {item.caption && (
                  <figcaption
                    style={{
                      position: 'absolute',
                      insetInline: 0,
                      bottom: 0,
                      padding: '0.75rem 1rem',
                      background: 'linear-gradient(transparent, rgba(15,23,42,0.85))',
                      color: '#fff',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                    }}
                  >
                    <span data-preview-field-path={`about.collageImages[${index}].caption`}>
                      {item.caption}
                    </span>
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      </EditableSection>
    </div>
  );
}
