'use client';

import {
  contentList,
  contentObject,
  contentText,
  platformProductDetailHref,
  useSiteData,
  useProducts,
} from '@/lib/siteDataContext';
import { pageRoute, withBasePath } from '@/lib/utils';
import {
  EditableText,
  EditableList,
  EditableCard,
  EditableImage,
} from '@deneb-ui/ui';


function navigate(pageKey: string) {
  window.location.href = withBasePath(pageRoute(pageKey));
}

export default function HomePage() {
  const siteData = useSiteData();
  const content = contentObject(siteData.content);
  const home = contentObject(content.home);
  const features = contentList(home.features);
  const products = useProducts();
  const demoCta = contentObject(
    (contentList(home.demoPreOrderCta)[0] as Record<string, unknown> | undefined) ?? {}
  );
  const demoCtaLabel = contentText(demoCta.buttonLabel) || 'Book a Demo';
  const demoCtaUrl = contentText(demoCta.buttonUrl) || '';
  const selectedPages =
    siteData.requirements?.requiredPages ??
    siteData.template?.structure?.pages ??
    [];

  return (
    <div data-preview-page-key="home">
      <section className="hero" data-design-section="home-hero">
        <div className="hero-copy">
          <EditableText
            variant="eyebrow"
            color="primary"
            className="eyebrow"
            data-preview-field-path="home.heroEyebrow"
            defaultValue={contentText(home.heroEyebrow)}
          />
          <EditableText
            variant="h1"
            size="5xl"
            weight="bold"
            align="left"
            color="heading"
            data-preview-field-path="home.heroTitle"
            defaultValue={contentText(home.heroTitle)}
          />
          <EditableText
            variant="lead"
            color="muted"
            data-preview-field-path="home.heroSummary"
            defaultValue={contentText(home.heroSummary)}
          />
          <div className="cta-row">
            {selectedPages.includes('contact') ? (
              <button
                type="button"
                data-target-page="contact"
                className="button-primary"
                onClick={() => navigate('contact')}
              >
                <span data-preview-field-path="home.primaryCtaLabel">
                  {contentText(home.primaryCtaLabel)}
                </span>
              </button>
            ) : (
              <span
                data-target-page="contact"
                className="button-primary unavailable"
                data-preview-field-path="home.primaryCtaLabel"
              >
                {contentText(home.primaryCtaLabel)}
              </span>
            )}
            {selectedPages.includes('about_us') ? (
              <button
                type="button"
                data-target-page="about_us"
                className="button-secondary"
                onClick={() => navigate('about_us')}
              >
                <span data-preview-field-path="home.secondaryCtaLabel">
                  {contentText(home.secondaryCtaLabel)}
                </span>
              </button>
            ) : (
              <span
                data-target-page="about_us"
                className="button-secondary unavailable"
                data-preview-field-path="home.secondaryCtaLabel"
              >
                {contentText(home.secondaryCtaLabel)}
              </span>
            )}
          </div>
        </div>
        <div className="hero-fivora-wrap">
          <img
            className="hero-image"
            src={withBasePath(
              contentText(home.bannerImageUrl) || '/fivora-icon.svg',
            )}
            alt="Fivora"
            data-preview-field-path="home.bannerImageUrl"
          />
        </div>
      </section>

      <section
        className="page-section"
        data-design-section="home-introduction"
      >
        <div className="home-intro-copy">
          <EditableText
            variant="h2"
            size="3xl"
            weight="bold"
            align="center"
            color="heading"
            data-preview-field-path="home.introTitle"
            defaultValue={contentText(home.introTitle)}
          />
          <EditableText
            variant="lead"
            align="center"
            color="muted"
            data-preview-field-path="home.introBody"
            defaultValue={contentText(home.introBody)}
          />
          <div
            style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}
            data-preview-list-path="home.demoPreOrderCta"
          >
            {contentList(home.demoPreOrderCta).map((rawCta, index) => {
              const cta = contentObject(rawCta);
              const label = contentText(cta.buttonLabel) || 'Book a Consultation';
              const url = contentText(cta.buttonUrl) || '#';
              return (
                <a
                  key={index}
                  href={url}
                  className="button-primary"
                  data-preview-item-path={`home.demoPreOrderCta[${index}]`}
                  data-preview-field-path={`home.demoPreOrderCta[${index}].buttonUrl`}
                >
                  <span data-preview-field-path={`home.demoPreOrderCta[${index}].buttonLabel`}>
                    {label}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="page-section alt"
        data-design-section="home-features"
      >
        <div className="section-header">
          <EditableText
            variant="h2"
            size="3xl"
            weight="bold"
            align="center"
            color="heading"
            className="section-title"
            data-preview-field-path="home.featuresHeading"
            defaultValue={contentText(home.featuresHeading)}
          />
        </div>
        <EditableList
          data-preview-list-path="home.features"
          items={features}
          className="card-grid"
          itemAs={false}
        >
          {(rawFeature, index) => {
            const feature = contentObject(rawFeature);
            return (
              <EditableCard
                className="card"
                key={index}
                itemPath={`home.features[${index}]`}
                data-preview-item-path={`home.features[${index}]`}
                item={feature as any}
                balance
                minHeight="220px"
                radius="16px"
              >
                <EditableText
                  variant="h3"
                  color="heading"
                  data-preview-field-path={`home.features[${index}].title`}
                  defaultValue={contentText(feature.title)}
                />
                <EditableText
                  variant="p"
                  color="muted"
                  data-preview-field-path={`home.features[${index}].body`}
                  defaultValue={contentText(feature.body)}
                />
              </EditableCard>
            );
          }}
        </EditableList>
      </section>

      <section
        className="page-section"
        data-design-section="home-products"
      >
        <div className="section-header product-section-header">
          <EditableText
            variant="h2"
            size="3xl"
            weight="bold"
            align="center"
            color="heading"
            className="section-title"
            data-preview-field-path="home.productsHeading"
            defaultValue={contentText(home.productsHeading)}
          />
          <EditableText
            variant="lead"
            align="center"
            color="muted"
            data-preview-field-path="home.productsSummary"
            defaultValue={contentText(home.productsSummary)}
          />
        </div>

        <div className="card-grid" data-preview-list-path="products">
          {products.map((rawProduct, index) => {
            const product = contentObject(rawProduct);
            const productId =
              typeof product.id === 'string' || typeof product.id === 'number'
                ? product.id
                : null;
            const price = typeof product.price === 'number' ? product.price : parseFloat(String(product.price || 0));
            const compareAt = typeof product.compareAtPrice === 'number' ? product.compareAtPrice : parseFloat(String(product.compareAtPrice || 0));
            const currency = contentText(product.currency) || 'LKR';
            const badge = contentText(product.badge);
            const category = contentText(product.category);

            return (
              <EditableCard
                key={productId ?? index}
                className="card product-card"
                item={product as any}
                itemPath={`products[${index}]`}
                data-preview-item-path={`products[${index}]`}
                balance
                radius="xl"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', marginBottom: '0.75rem' }}>
                  <EditableImage
                    src={contentText(product.imageUrl) || '/placeholder.svg'}
                    alt={contentText(product.name)}
                    data-preview-field-path={`products[${index}].imageUrl`}
                    aspectRatio="4/3"
                    fit="cover"
                    radius="lg"
                  />
                  {badge && (
                    <span
                      className="badge-primary"
                      data-preview-field-path={`products[${index}].badge`}
                      style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}
                    >
                      {badge}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '0.5rem' }}>
                  {category && (
                    <span
                      className="tag"
                      data-preview-field-path={`products[${index}].category`}
                      style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      {category}
                    </span>
                  )}
                  <EditableText
                    variant="h3"
                    size="lg"
                    weight="bold"
                    color="heading"
                    data-preview-field-path={`products[${index}].name`}
                    defaultValue={contentText(product.name)}
                  />
                  <EditableText
                    variant="p"
                    color="muted"
                    data-preview-field-path={`products[${index}].description`}
                    defaultValue={contentText(product.description)}
                  />

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.75rem' }}>
                    <EditableText
                      as="span"
                      weight="bold"
                      size="xl"
                      color="primary"
                      data-preview-field-path={`products[${index}].price`}
                      defaultValue={`${currency} ${price}`}
                    />
                    {compareAt > 0 && (
                      <EditableText
                        as="span"
                        color="muted"
                        style={{ textDecoration: 'line-through', fontSize: '0.875rem' }}
                        data-preview-field-path={`products[${index}].compareAtPrice`}
                        defaultValue={`${currency} ${compareAt}`}
                      />
                    )}
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <a
                      href={platformProductDetailHref(productId)}
                      className="button-secondary"
                      style={{ width: '100%', textAlign: 'center' }}
                      data-preview-static="Open the stable live product detail page"
                    >
                      View details
                    </a>
                  </div>
                </div>
              </EditableCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
