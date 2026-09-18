'use client';

import { HeritageCollage, EditableText, EditableImage } from '@deneb-ui/ui';
import { contentObject, contentText, contentList, useSiteData } from '@/lib/siteDataContext';

export default function AboutPage() {
  const siteData = useSiteData();
  const about = contentObject(contentObject(siteData.content).about);
  const collageImages = contentList(about.collageImages) as Array<{ id?: string; image?: string; caption?: string }>;

  return (
    <div data-preview-page-key="about_us">
      <section className="page-section split" data-design-section="about">
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
      </section>

      <section className="page-section" data-design-section="about-heritage">
        <HeritageCollage
          collageHeading={contentText(about.collageHeading)}
          collageDescription={contentText(about.collageDescription)}
          historyHeading={contentText(about.historyHeading)}
          history={contentText(about.history)}
          images={collageImages}
          collageHeadingPath="about.collageHeading"
          collageDescriptionPath="about.collageDescription"
          historyHeadingPath="about.historyHeading"
          historyPath="about.history"
          listPath="about.collageImages"
        />
      </section>
    </div>
  );
}
