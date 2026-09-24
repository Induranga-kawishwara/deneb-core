'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STANDARD_VIEWPORTS,
  calculateVisualPreservation,
  extractDesignSnapshot,
} = require('../visual-regression.cjs');

test('Visual Regression: extracts element tags, layout classes, and compound icons', () => {
  const code = `
    export function Hero() {
      return (
        <section className="relative flex flex-col md:grid md:grid-cols-2 gap-8 p-12 bg-white">
          <h1 className="text-4xl font-bold">Original Title</h1>
          <button className="btn flex items-center gap-2">
            <svg className="w-5 h-5" />
            <span>Order Now</span>
          </button>
        </section>
      );
    }
  `;

  const snapshot = extractDesignSnapshot(code);
  assert.ok(snapshot.tags.includes('section'));
  assert.ok(snapshot.tags.includes('h1'));
  assert.ok(snapshot.tags.includes('button'));
  assert.ok(snapshot.classes.has('flex'));
  assert.ok(snapshot.classes.has('md:grid-cols-2'));

  const btnElem = snapshot.elements.find((e) => e.tag === 'button');
  assert.ok(btnElem);
  assert.equal(btnElem.hasSvg, true);
  assert.equal(btnElem.hasSpan, true);
});

test('Visual Regression: calculates >= 98% design preservation on valid ARC transformation', () => {
  const beforeCode = `
    export function Banner() {
      return (
        <div className="grid grid-cols-3 gap-6 p-8">
          <h2>Featured Items</h2>
          <p>Hand-picked for you</p>
        </div>
      );
    }
  `;

  // Transformed code has siteData getters and preview marker, but identical layout classes & tags
  const afterCode = `
    export function Banner() {
      return (
        <div className="grid grid-cols-3 gap-6 p-8">
          <h2 data-preview-field-path="home.banner.title">{siteData?.content?.home?.banner?.title ?? "Featured Items"}</h2>
          <p data-preview-field-path="home.banner.subtitle">{siteData?.content?.home?.banner?.subtitle ?? "Hand-picked for you"}</p>
        </div>
      );
    }
  `;

  const report = calculateVisualPreservation(beforeCode, afterCode);
  assert.equal(report.passed, true);
  assert.ok(report.overallPreservationScore >= 98.0);
  assert.ok(report.viewports.mobile.preservationScore >= 98.0);
  assert.ok(report.viewports.tablet.preservationScore >= 98.0);
  assert.ok(report.viewports.desktop.preservationScore >= 98.0);
  assert.equal(report.blockingIssues.length, 0);
});

test('Visual Regression: detects dropped layout classes or icons and reports blocking issue', () => {
  const beforeCode = `
    export function Action() {
      return (
        <button className="btn">
          <svg className="icon" />
          <span>Checkout</span>
        </button>
      );
    }
  `;

  // Broken transform accidentally removed the svg icon
  const brokenCode = `
    export function Action() {
      return (
        <button className="btn">
          <span>Checkout</span>
        </button>
      );
    }
  `;

  const report = calculateVisualPreservation(beforeCode, brokenCode);
  assert.equal(report.passed, false);
  assert.ok(report.blockingIssues.length > 0);
  assert.ok(report.blockingIssues[0].includes('SVG or icon dropped'));
});
