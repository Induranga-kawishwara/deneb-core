'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  INTERACTIVE_PATTERNS,
  analyzeComponentInteractivity,
  verifyInteractionsSync,
} = require('../interaction-verifier.cjs');

test('Interaction Verifier: detects mobile menu toggles and event handlers', () => {
  const code = `
    export function Navbar() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <nav>
          <button
            aria-label="Toggle Menu"
            className="hamburger-menu"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span />
          </button>
        </nav>
      );
    }
  `;

  const report = verifyInteractionsSync({ code, componentName: 'Navbar' });
  assert.equal(report.passed, true);
  assert.equal(report.interactionScore, 100.0);

  const toggleCheck = report.patterns.find((p) => p.pattern === INTERACTIVE_PATTERNS.NAVBAR_MOBILE_TOGGLE);
  assert.ok(toggleCheck);
  assert.equal(toggleCheck.passed, true);
});

test('Interaction Verifier: detects accordions, tabs, dialogs, and carousels across files', () => {
  const files = [
    {
      file: 'components/Faq.tsx',
      code: `export function Faq() { return <AccordionTrigger>Question 1</AccordionTrigger>; }`,
    },
    {
      file: 'components/ProductTabs.tsx',
      code: `export function ProductTabs() { return <TabsTrigger value="details">Details</TabsTrigger>; }`,
    },
    {
      file: 'components/QuickView.tsx',
      code: `export function QuickView() { return <Dialog>Content</Dialog>; }`,
    },
    {
      file: 'components/HeroCarousel.tsx',
      code: `export function HeroCarousel() { return <Swiper><SwiperSlide>1</SwiperSlide></Swiper>; }`,
    },
    {
      file: 'components/ContactForm.tsx',
      code: `export function ContactForm() { return <form onSubmit={(e) => handleSubmit(e)}><button type="submit">Send</button></form>; }`,
    },
  ];

  const report = verifyInteractionsSync({ files });
  assert.equal(report.passed, true);
  assert.equal(report.totalTested, 5);
  assert.equal(report.passedTests, 5);
  assert.equal(report.failedTests, 0);
  assert.equal(report.interactionScore, 100.0);
});

test('Interaction Verifier: flags missing event handler on interactive trigger', () => {
  const code = `
    export function BrokenNav() {
      return (
        <button aria-label="Toggle Menu" className="nav-toggle">
          <span>Click</span>
        </button>
      );
    }
  `;

  const report = verifyInteractionsSync({ code, componentName: 'BrokenNav' });
  assert.equal(report.passed, false);
  assert.equal(report.failedTests, 1);
  assert.ok(report.patterns[0].reason.includes('Missing onClick handler'));
});
