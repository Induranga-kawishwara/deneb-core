import { FontPairing } from './types';

export const GLOBAL_FONT_OPTIONS = [
  'Inter',
  'Playfair Display',
  'DM Sans',
  'Poppins',
  'Montserrat',
  'Plus Jakarta Sans',
  'Georgia',
  'Editorial Serif',
] as const;

export type GlobalFontOption = (typeof GLOBAL_FONT_OPTIONS)[number];

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'modern-clean',
    name: 'Modern & Clean',
    headingFont: 'Plus Jakarta Sans',
    bodyFont: 'Inter',
    description: 'Crisp, contemporary tech and SaaS feel with high readability',
  },
  {
    id: 'editorial-luxury',
    name: 'Editorial Luxury',
    headingFont: 'Playfair Display',
    bodyFont: 'Inter',
    description: 'Elegant serif headline paired with neutral modern body text',
  },
  {
    id: 'tech-forward',
    name: 'Tech Forward',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    description: 'Minimalist, uniform sans-serif design system',
  },
  {
    id: 'vibrant-lifestyle',
    name: 'Vibrant Lifestyle',
    headingFont: 'Poppins',
    bodyFont: 'DM Sans',
    description: 'Warm, geometric sans pairing suited for retail and wellness',
  },
  {
    id: 'classic-prestige',
    name: 'Classic Prestige',
    headingFont: 'Montserrat',
    bodyFont: 'Inter',
    description: 'Authoritative, balanced typography for premium brands',
  },
];
