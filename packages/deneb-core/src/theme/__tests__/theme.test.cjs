const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  THEME_PALETTES,
  GLOBAL_FONT_OPTIONS,
  FONT_PAIRINGS,
  isDarkColor,
  getAutoContrastTextColor,
  toHexColor,
  generateThemeVariables,
  parseVisualCustomization,
  customizationToTheme,
} = require('../../../dist/index.js');

describe('DENEB Theme Engine', () => {
  it('exports curated palettes covering light and dark modes', () => {
    assert.ok(Array.isArray(THEME_PALETTES));
    assert.ok(THEME_PALETTES.length >= 8);
    const darkPalettes = THEME_PALETTES.filter((p) => p.mode === 'dark');
    const lightPalettes = THEME_PALETTES.filter((p) => p.mode === 'light');
    assert.ok(darkPalettes.length >= 4);
    assert.ok(lightPalettes.length >= 4);
  });

  it('correctly identifies dark vs light colors using relative luminance', () => {
    assert.equal(isDarkColor('#000000'), true);
    assert.equal(isDarkColor('#090d16'), true);
    assert.equal(isDarkColor('#111a2e'), true);
    assert.equal(isDarkColor('#ffffff'), false);
    assert.equal(isDarkColor('#f8fafc'), false);
    assert.equal(isDarkColor('#fdfbf7'), false);
    assert.equal(isDarkColor('#000'), true);
    assert.equal(isDarkColor('#fff'), false);
  });

  it('computes auto-contrast text colors for button readability', () => {
    assert.equal(getAutoContrastTextColor('#000000'), '#ffffff');
    assert.equal(getAutoContrastTextColor('#090d16'), '#ffffff');
    assert.equal(getAutoContrastTextColor('#ffffff'), '#0f172a');
    assert.equal(getAutoContrastTextColor('#f8fafc'), '#0f172a');
  });

  it('normalizes hex values with toHexColor', () => {
    assert.equal(toHexColor('#fff', '#000000'), '#ffffff');
    assert.equal(toHexColor('#000', '#ffffff'), '#000000');
    assert.equal(toHexColor('#2563EB', '#000000'), '#2563eb');
    assert.equal(toHexColor('invalid', '#2563eb'), '#2563eb');
  });

  it('generates consistent CSS variables with auto-contrast button tokens', () => {
    const darkTheme = {
      backgroundColor: '#090d16',
      primaryColor: '#60a5fa',
      textColor: '#f8fafc',
    };
    const vars = generateThemeVariables(darkTheme);
    assert.equal(vars['--page-background'], '#090d16');
    assert.equal(vars['--button-bg'], '#60a5fa');
    // Button is light blue (#60a5fa), so auto button text should be dark slate (#0f172a)
    assert.equal(vars['--button-text'], '#0f172a');
    assert.equal(vars['--button-secondary-bg'], 'rgba(255, 255, 255, 0.08)');
  });

  it('parses and converts visual customization payloads into template theme shapes', () => {
    const rawCustomization = {
      version: 1,
      colors: {
        primary: '#6366f1',
        background: '#09090b',
        text: '#f4f4f5',
      },
      typography: {
        headingFont: 'Plus Jakarta Sans',
        bodyFont: 'Inter',
      },
    };
    const parsed = parseVisualCustomization(rawCustomization);
    assert.equal(parsed.colors?.primary, '#6366f1');
    const theme = customizationToTheme(parsed);
    assert.equal(theme.primaryColor, '#6366f1');
    assert.equal(theme.backgroundColor, '#09090b');
    assert.equal(theme.headingFont, 'Plus Jakarta Sans');
  });

  it('exposes font options and pairings', () => {
    assert.ok(GLOBAL_FONT_OPTIONS.includes('Inter'));
    assert.ok(GLOBAL_FONT_OPTIONS.includes('Plus Jakarta Sans'));
    assert.ok(FONT_PAIRINGS.length >= 3);
  });
});
