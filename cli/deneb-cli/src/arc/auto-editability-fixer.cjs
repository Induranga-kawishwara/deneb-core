'use strict';

/**
 * Deneb ARC — Auto Editability Fixer
 *
 * Scans source files for JSX elements that render dynamic content (text/images)
 * WITHOUT a data-preview-field-path attribute. Auto-generates field paths,
 * patches the source files, populates site-data.json, and updates the ARC recipe.
 *
 * Runs automatically during `deneb init` post-processing.
 * Also available standalone: `deneb fix-editability`
 *
 * Core principle: Every merchant-visible text node and image that comes from
 * a data source MUST have a field path so the Deneb editor can edit it.
 */

const fs = require('fs');
const path = require('path');
const { readJsonSafe, writeJson } = require('./fs-utils.cjs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatLKR(price) {
  return 'LKR ' + Number(price).toLocaleString('en-US');
}

function formatKm(km) {
  return Number(km).toLocaleString('en-US') + ' km';
}

// ─── Project data readers ─────────────────────────────────────────────────────

/**
 * Reads vehicle data from the project's data/vehicles.ts file.
 */
function readVehiclesFromProject(projectDir) {
  const vehiclesPath = path.join(projectDir, 'data', 'vehicles.ts');
  if (!fs.existsSync(vehiclesPath)) return [];

  const content = fs.readFileSync(vehiclesPath, 'utf-8');
  const blockRe = /build\(\{([\s\S]*?)\}\)/g;
  const vehicles = [];
  let m;
  while ((m = blockRe.exec(content)) !== null) {
    const block = m[1];
    const str = (key) => {
      const r = new RegExp(key + ':\\s*"([^"]+)"');
      const sm = block.match(r);
      return sm ? sm[1] : '';
    };
    const num = (key) => {
      const r = new RegExp(key + ':\\s*([\\d_]+)');
      const nm = block.match(r);
      return nm ? parseInt(nm[1].replace(/_/g, ''), 10) : 0;
    };
    const id = str('id');
    if (!id) continue;
    vehicles.push({
      id,
      make: str('make'),
      model: str('model'),
      variant: str('variant'),
      year: num('year'),
      price: num('price'),
      mileageKm: num('mileageKm'),
      fuel: str('fuel'),
      transmission: str('transmission'),
      condition: str('condition'),
      status: str('status'),
    });
  }
  return vehicles;
}

/**
 * Reads showroom data from the project's lib/site-config.ts file.
 */
function readShowroomsFromProject(projectDir) {
  const configPath = path.join(projectDir, 'lib', 'site-config.ts');
  if (!fs.existsSync(configPath)) return [];

  const content = fs.readFileSync(configPath, 'utf-8');
  // Extract showroom blocks
  const showroomRe = /\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?addressLines:\s*\[([^\]]+)\][\s\S]*?city:\s*"([^"]+)"[\s\S]*?(?:notes:\s*"([^"]*)")?/g;
  const showrooms = [];
  let m;
  while ((m = showroomRe.exec(content)) !== null) {
    const addressLines = m[3]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    showrooms.push({
      id: m[1],
      name: m[2],
      addressLines,
      city: m[4] || '',
      notes: m[5] || '',
    });
  }
  return showrooms;
}

/**
 * Reads body types and descriptions from the project's lib/vehicle-options.ts.
 */
function readBodyTypesFromProject(projectDir) {
  const optionsPath = path.join(projectDir, 'lib', 'vehicle-options.ts');
  if (!fs.existsSync(optionsPath)) {
    return {
      bodyTypes: ['Hatchback', 'Sedan', 'SUV', 'Crossover', 'Pickup', 'Van'],
      descriptions: {},
    };
  }
  const content = fs.readFileSync(optionsPath, 'utf-8');

  const arrMatch = content.match(/BODY_TYPES[^=]*=\s*\[([\s\S]*?)\]/);
  const bodyTypes = arrMatch
    ? (arrMatch[1].match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ''))
    : ['Hatchback', 'Sedan', 'SUV', 'Crossover', 'Pickup', 'Van'];

  const descMatch = content.match(/BODY_TYPE_DESCRIPTIONS[\s\S]*?=\s*\{([\s\S]*?)\}/);
  const descriptions = {};
  if (descMatch) {
    const descRe = /["']?([A-Za-z0-9_-]+)["']?:\s*"([^"]+)"/g;
    let dm;
    while ((dm = descRe.exec(descMatch[1])) !== null) {
      descriptions[dm[1]] = dm[2];
    }
  }
  return { bodyTypes, descriptions };
}

// ─── Site-data entry generators ────────────────────────────────────────────────

function generateVehicleCardEntries(vehicles) {
  const entries = {};
  for (const v of vehicles) {
    entries[v.id] = {
      name: v.make + ' ' + v.model,
      meta: v.year + ' \u00b7 ' + v.condition,
      details: v.variant,
      badge: v.status,
      mileage: formatKm(v.mileageKm),
      mileageIcon: 'gauge',
      fuel: v.fuel,
      fuelIcon: v.fuel === 'Electric' ? 'zap' : 'fuel',
      transmission: v.transmission,
      transmissionIcon: 'settings',
      price: formatLKR(v.price),
    };
  }
  return entries;
}

function generateBrandCardEntries(vehicles) {
  const counts = {};
  for (const v of vehicles) {
    if (v.status !== 'Sold') {
      counts[v.make] = (counts[v.make] || 0) + 1;
    }
  }
  const entries = {};
  for (const make of Object.keys(counts)) {
    const count = counts[make];
    entries[slugify(make)] = {
      displayName: make,
      countLabel: count + ' ' + (count === 1 ? 'car' : 'cars'),
    };
  }
  return entries;
}

function generateBodyTypeEntries(bodyTypes, descriptions) {
  const entries = {};
  for (const type of bodyTypes) {
    entries[slugify(type)] = {
      displayName: type,
      description: descriptions[type] || '',
    };
  }
  return entries;
}

function generateShowroomEntries(showrooms) {
  const entries = {};
  for (const s of showrooms) {
    entries[s.id] = {
      name: s.name,
      address: s.addressLines.join(', '),
      notes: s.notes || '',
      city: s.city || '',
    };
  }
  return entries;
}

function generateVehiclePhotoEntries(vehicles) {
  const entries = {};
  for (const v of vehicles) {
    entries[v.id] = { image0: '' };
  }
  return entries;
}

// ─── Recipe section generators ─────────────────────────────────────────────────

function buildVehicleCardRecipeSection(vehicles) {
  return {
    id: 'cards.vehicles',
    path: 'cards.vehicles',
    type: 'collection',
    label: 'Vehicle Card Text',
    description: 'Edit the displayed text for each vehicle listing card',
    collectionType: 'keyed',
    items: vehicles.map((v) => ({
      key: v.id,
      label: v.make + ' ' + v.model + ' (' + v.year + ')',
      fields: [
        { key: 'name', type: 'text', label: 'Display Name' },
        { key: 'meta', type: 'text', label: 'Year & Condition' },
        { key: 'details', type: 'text', label: 'Variant / Details' },
        { key: 'badge', type: 'text', label: 'Status Badge' },
        { key: 'mileage', type: 'text', label: 'Mileage' },
        { key: 'mileageIcon', type: 'text', label: 'Mileage Icon (e.g. gauge, timer, clock)' },
        { key: 'fuel', type: 'text', label: 'Fuel Type' },
        { key: 'fuelIcon', type: 'text', label: 'Fuel Icon (e.g. fuel, zap, battery)' },
        { key: 'transmission', type: 'text', label: 'Transmission' },
        { key: 'transmissionIcon', type: 'text', label: 'Transmission Icon (e.g. settings, gear, zap)' },
        { key: 'price', type: 'text', label: 'Display Price' },
      ],
    })),
  };
}

function buildBrandCardRecipeSection(makes) {
  return {
    id: 'cards.brands',
    path: 'cards.brands',
    type: 'collection',
    label: 'Brand Cards',
    description: 'Override brand display names and count labels on the brand browse grid',
    collectionType: 'keyed',
    items: makes.map((make) => ({
      key: slugify(make),
      label: make,
      fields: [
        { key: 'displayName', type: 'text', label: 'Display Name' },
        { key: 'countLabel', type: 'text', label: 'Count Label' },
      ],
    })),
  };
}

function buildBodyTypeRecipeSection(bodyTypes) {
  return {
    id: 'cards.bodyTypes',
    path: 'cards.bodyTypes',
    type: 'collection',
    label: 'Body Type Cards',
    description: 'Override body type names and descriptions on the browse-by-body-type grid',
    collectionType: 'keyed',
    items: bodyTypes.map((type) => ({
      key: slugify(type),
      label: type,
      fields: [
        { key: 'displayName', type: 'text', label: 'Display Name' },
        { key: 'description', type: 'text', label: 'Short Description' },
      ],
    })),
  };
}

function buildShowroomRecipeSection(showrooms) {
  return {
    id: 'showrooms',
    path: 'showrooms',
    type: 'collection',
    label: 'Showroom Details',
    description: 'Edit showroom names, addresses, and notes',
    collectionType: 'keyed',
    items: showrooms.map((s) => ({
      key: s.id,
      label: s.name,
      fields: [
        { key: 'name', type: 'text', label: 'Showroom Name' },
        { key: 'address', type: 'textarea', label: 'Address' },
        { key: 'notes', type: 'textarea', label: 'Notes / Holiday Notice' },
        { key: 'city', type: 'text', label: 'City' },
      ],
    })),
  };
}

function buildVehiclePhotosRecipeSection(vehicles) {
  return {
    id: 'photos.vehicles',
    path: 'photos.vehicles',
    type: 'collection',
    label: 'Vehicle Photos',
    description: 'Replace photos for each vehicle listing',
    collectionType: 'keyed',
    items: vehicles.map((v) => ({
      key: v.id,
      label: v.make + ' ' + v.model + ' (' + v.year + ')',
      fields: [{ key: 'image0', type: 'image', label: 'Primary Photo' }],
    })),
  };
}


function buildGenericCardRecipeSection(collectionKey, collectionObj) {
  const items = [];
  const entries = collectionObj && typeof collectionObj === 'object' ? collectionObj : {};
  for (const id of Object.keys(entries)) {
    const item = entries[id];
    if (!item || typeof item !== 'object') continue;
    const fields = [];
    for (const fKey of Object.keys(item)) {
      const val = item[fKey];
      if (typeof val === 'string') {
        const isIcon = fKey === 'icon' || fKey.endsWith('Icon') || /icon/i.test(fKey);
        const isLong = val.length > 80;
        fields.push({
          key: fKey,
          type: isIcon ? 'text' : isLong ? 'textarea' : 'text',
          ...(isIcon ? { control: 'icon-picker' } : {}),
          label: fKey.charAt(0).toUpperCase() + fKey.slice(1).replace(/([A-Z])/g, ' $1'),
        });
      } else if (fKey === 'specs' && val && typeof val === 'object') {
        for (const specKey of Object.keys(val)) {
          const specVal = val[specKey];
          if (specVal && typeof specVal === 'object') {
            if (specVal.icon) {
              fields.push({
                key: `specs.${specKey}.icon`,
                type: 'text',
                control: 'icon-picker',
                label: `${specKey.charAt(0).toUpperCase() + specKey.slice(1)} Icon`,
              });
            }
            if (specVal.value) {
              fields.push({
                key: `specs.${specKey}.value`,
                type: 'text',
                label: `${specKey.charAt(0).toUpperCase() + specKey.slice(1)} Value`,
              });
            }
          }
        }
      }
    }
    items.push({
      key: id,
      label: item.title || item.name || item.displayName || id,
      fields,
    });
  }
  return {
    id: `cards.${collectionKey}`,
    path: `cards.${collectionKey}`,
    type: 'collection',
    label: `${collectionKey.charAt(0).toUpperCase() + collectionKey.slice(1)} Cards`,
    description: `Edit card text for ${collectionKey}`,
    collectionType: 'keyed',
    items,
  };
}

// ─── Section management ────────────────────────────────────────────────────────

const MANAGED_SECTION_IDS = new Set([
  'cards.vehicles',
  'cards.brands',
  'cards.bodyTypes',
  'showrooms',
  'photos.vehicles',
  'home.benefits',
]);

function buildBenefitsRecipeSection() {
  return {
    id: 'home.benefits',
    path: 'home.benefits',
    type: 'collection',
    label: 'Home Benefits & Features',
    description: 'Edit icons, titles, and explanations for Why Buy With Us benefit cards',
    collectionType: 'list',
    items: [
      {
        key: '0',
        label: 'Evidence you can see',
        fields: [
          { key: 'icon', type: 'text', label: 'Icon', control: 'icon-picker' },
          { key: 'title', type: 'text', label: 'Title' },
          { key: 'text', type: 'textarea', label: 'Description' },
        ],
      },
      {
        key: '1',
        label: 'WhatsApp-first service',
        fields: [
          { key: 'icon', type: 'text', label: 'Icon', control: 'icon-picker' },
          { key: 'title', type: 'text', label: 'Title' },
          { key: 'text', type: 'textarea', label: 'Description' },
        ],
      },
      {
        key: '2',
        label: 'Clear numbers upfront',
        fields: [
          { key: 'icon', type: 'text', label: 'Icon', control: 'icon-picker' },
          { key: 'title', type: 'text', label: 'Title' },
          { key: 'text', type: 'textarea', label: 'Description' },
        ],
      },
      {
        key: '3',
        label: 'Sourcing on request',
        fields: [
          { key: 'icon', type: 'text', label: 'Icon', control: 'icon-picker' },
          { key: 'title', type: 'text', label: 'Title' },
          { key: 'text', type: 'textarea', label: 'Description' },
        ],
      },
    ],
  };
}

function removeManagedSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.filter((s) => !MANAGED_SECTION_IDS.has(s.id));
}

// ─── Component patchers ────────────────────────────────────────────────────────

function patchVehicleCard(projectDir, dryRun, log, report) {
  const filePath = path.join(projectDir, 'components', 'vehicles', 'vehicle-card.tsx');
  if (!fs.existsSync(filePath)) return;

  let source = fs.readFileSync(filePath, 'utf-8');
  if (source.includes('cards.vehicles.') && source.includes('readVehicleCardField')) return;

  log('[auto-fix] Patching vehicle-card.tsx for editable fields...');
  let changed = false;

  if (!source.includes('useSiteData')) {
    source = '"use client";\nimport { useSiteData } from "@deneb-ui/ui";\n' + source.replace(/^"use client";?\n?/, '');
    changed = true;
  }

  if (!source.includes('readVehicleCardField')) {
    const helper = [
      '',
      'function readVehicleCardField(',
      '  content: unknown,',
      '  vehicleId: string,',
      '  field: string,',
      '  fallback: string',
      '): string {',
      '  const cards = (content as Record<string, unknown> | undefined)?.cards as',
      '    | Record<string, unknown>',
      '    | undefined;',
      '  const vehicles = cards?.vehicles as Record<string, unknown> | undefined;',
      '  const entry = vehicles?.[vehicleId] as Record<string, unknown> | undefined;',
      '  const val = entry?.[field];',
      '  return typeof val === "string" && val ? val : fallback;',
      '}',
      '',
      'function vcfp(id: string, field: string) {',
      '  return `cards.vehicles.${id}.${field}`;',
      '}',
      '',
    ].join('\r\n');

    source = source.replace(/(\r?\nexport function VehicleCard\()/, '\r\n' + helper + '\r\nexport function VehicleCard(');
    changed = true;
  }

  if (changed && !dryRun) {
    fs.writeFileSync(filePath, source, 'utf-8');
    report.fixed.push('components/vehicles/vehicle-card.tsx');
    log('[auto-fix] Saved vehicle-card.tsx');
  }
}


function patchVehicleCollections(projectDir, dryRun, log, report) {
  const filePath = path.join(projectDir, 'components', 'vehicles', 'vehicle-collections.tsx');
  if (!fs.existsSync(filePath)) return;

  let source = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // ── BrowseByBrand ──────────────────────────────────────────────────────────
  if (!source.includes('cards.brands.')) {
    log('[auto-fix] Patching BrowseByBrand...');

    // 1. Add readBrandField helper before the function
    if (!source.includes('readBrandField')) {
      const helper = [
        '',
        'function readBrandField(content: unknown, make: string, field: string, fallback: string): string {',
        "  const slug = make.toLowerCase().replace(/[^a-z0-9]+/g, '-');",
        '  const cards = (content as Record<string, unknown> | undefined)?.cards as Record<string, unknown> | undefined;',
        '  const brands = cards?.brands as Record<string, unknown> | undefined;',
        '  const entry = brands?.[slug] as Record<string, unknown> | undefined;',
        '  const val = entry?.[field];',
        '  return typeof val === "string" && val ? val : fallback;',
        '}',
        '',
      ].join('\r\n');
      source = source.replace(
        /\r?\nexport function BrowseByBrand\(\)/,
        '\r\n' + helper + '\r\nexport function BrowseByBrand()'
      );
    }

    // 2. Add useSiteData() call inside BrowseByBrand
    if (!source.match(/BrowseByBrand[\s\S]{0,300}useSiteData/)) {
      source = source.replace(
        /(export function BrowseByBrand\(\) \{\r?\n)([ \t]+)(const vehicles = usePublicVehicles\(\))/,
        '$1$2const siteData = useSiteData();\r\n$2$3'
      );
    }

    // 3. Patch brand name span
    source = source.replace(
      /<span className="block truncate font-display text-xl font-bold tracking-wide uppercase">\{make\}<\/span>/g,
      '<span\r\n              className="block truncate font-display text-xl font-bold tracking-wide uppercase"\r\n              data-preview-field-path={`cards.brands.${make.toLowerCase().replace(/[^a-z0-9]+/g, \'-\')}.displayName`}\r\n              data-preview-style-target={`cards.brands.${make.toLowerCase().replace(/[^a-z0-9]+/g, \'-\')}.displayName`}\r\n              data-preview-style-type="text"\r\n            >{readBrandField(siteData?.content, make, \'displayName\', make)}</span>'
    );

    // 4. Patch count span
    source = source.replace(
      /<span className="text-xs text-muted-foreground">\r?\n[ \t]+\{count\} \{count === 1 \? "car" : "cars"\}\r?\n[ \t]+<\/span>/g,
      '<span\r\n              className="text-xs text-muted-foreground"\r\n              data-preview-field-path={`cards.brands.${make.toLowerCase().replace(/[^a-z0-9]+/g, \'-\')}.countLabel`}\r\n              data-preview-style-target={`cards.brands.${make.toLowerCase().replace(/[^a-z0-9]+/g, \'-\')}.countLabel`}\r\n              data-preview-style-type="text"\r\n            >{readBrandField(siteData?.content, make, \'countLabel\', `${count} ${count === 1 ? \'car\' : \'cars\'}`)}</span>'
    );

    changed = true;
  }

  // ── BrowseByBodyType ────────────────────────────────────────────────────────
  if (!source.includes('cards.bodyTypes.')) {
    log('[auto-fix] Patching BrowseByBodyType...');

    // 1. Add readBodyTypeField helper
    if (!source.includes('readBodyTypeField')) {
      const helper = [
        '',
        'function readBodyTypeField(content: unknown, type: string, field: string, fallback: string): string {',
        "  const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, '-');",
        '  const cards = (content as Record<string, unknown> | undefined)?.cards as Record<string, unknown> | undefined;',
        '  const bodyTypes = cards?.bodyTypes as Record<string, unknown> | undefined;',
        '  const entry = bodyTypes?.[slug] as Record<string, unknown> | undefined;',
        '  const val = entry?.[field];',
        '  return typeof val === "string" && val ? val : fallback;',
        '}',
        '',
      ].join('\r\n');
      source = source.replace(
        /\r?\nexport function BrowseByBodyType\(\)/,
        '\r\n' + helper + '\r\nexport function BrowseByBodyType()'
      );
    }

    // 2. Add useSiteData() call inside BrowseByBodyType
    if (!source.match(/BrowseByBodyType[\s\S]{0,400}useSiteData/)) {
      source = source.replace(
        /(export function BrowseByBodyType\(\) \{\r?\n)([ \t]+)(const vehicles = usePublicVehicles\(\))/,
        '$1$2const siteData = useSiteData();\r\n$2$3'
      );
    }

    // 3. Patch type name span
    source = source.replace(
      /<span className="block font-display text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">\r?\n[ \t]+\{type\}\r?\n[ \t]+<\/span>/g,
      '<span\r\n                className="block font-display text-xl font-bold tracking-wide text-white uppercase sm:text-2xl"\r\n                data-preview-field-path={`cards.bodyTypes.${type.toLowerCase().replace(/[^a-z0-9]+/g, \'-\')}.displayName`}\r\n                data-preview-style-target={`cards.bodyTypes.${type.toLowerCase().replace(/[^a-z0-9]+/g, \'-\')}.displayName`}\r\n                data-preview-style-type="text"\r\n              >{readBodyTypeField(siteData?.content, type, \'displayName\', type)}</span>'
    );

    // 4. Patch description span
    source = source.replace(
      /<span className="hidden text-xs text-white\/75 sm:block">\{BODY_TYPE_DESCRIPTIONS\[type\]\}<\/span>/g,
      '<span\r\n                className="hidden text-xs text-white/75 sm:block"\r\n                data-preview-field-path={`cards.bodyTypes.${type.toLowerCase().replace(/[^a-z0-9]+/g, \'-\')}.description`}\r\n                data-preview-style-target={`cards.bodyTypes.${type.toLowerCase().replace(/[^a-z0-9]+/g, \'-\')}.description`}\r\n                data-preview-style-type="text"\r\n              >{readBodyTypeField(siteData?.content, type, \'description\', BODY_TYPE_DESCRIPTIONS[type])}</span>'
    );

    changed = true;
  }

  if (changed && !dryRun) {
    fs.writeFileSync(filePath, source, 'utf-8');
    report.fixed.push('components/vehicles/vehicle-collections.tsx');
    log('[auto-fix] Saved vehicle-collections.tsx');
  }
}

function patchShowroomCard(projectDir, dryRun, log, report) {
  const filePath = path.join(projectDir, 'components', 'layout', 'showroom-card.tsx');
  if (!fs.existsSync(filePath)) return;

  let source = fs.readFileSync(filePath, 'utf-8');

  // Skip if already patched
  if (source.includes('`showrooms.${showroom.id}.name`')) return;

  log('[auto-fix] Patching showroom-card.tsx...');

  // 1. Add readShowroomField helper
  if (!source.includes('readShowroomField')) {
    const helper = [
      '',
      'function readShowroomField(content: unknown, id: string, field: string, fallback: string): string {',
      '  const showrooms = (content as Record<string, unknown> | undefined)?.showrooms as Record<string, unknown> | undefined;',
      '  const entry = showrooms?.[id] as Record<string, unknown> | undefined;',
      '  const val = entry?.[field];',
      '  return typeof val === "string" && val ? val : fallback;',
      '}',
      '',
    ].join('\r\n');
    source = source.replace(
      /\r?\nexport function ShowroomHoursList/,
      '\r\n' + helper + '\r\nexport function ShowroomHoursList'
    );
  }

  // 2. Patch showroom name
  source = source.replace(
    /<CardTitle className="font-display text-2xl font-bold tracking-tight uppercase">\{showroom\.name\}<\/CardTitle>/g,
    '<CardTitle\r\n          className="font-display text-2xl font-bold tracking-tight uppercase"\r\n          data-preview-field-path={`showrooms.${showroom.id}.name`}\r\n          data-preview-style-target={`showrooms.${showroom.id}.name`}\r\n          data-preview-style-type="text"\r\n        >\r\n          {readShowroomField(siteData?.content, showroom.id, \'name\', showroom.name)}\r\n        </CardTitle>'
  );

  // 3. Patch address
  source = source.replace(
    /(\{showroom\.addressLines\.join\(", "\)\})/g,
    '<span\r\n            data-preview-field-path={`showrooms.${showroom.id}.address`}\r\n            data-preview-style-target={`showrooms.${showroom.id}.address`}\r\n            data-preview-style-type="text"\r\n          >{readShowroomField(siteData?.content, showroom.id, \'address\', showroom.addressLines.join(\', \'))}</span>'
  );

  // 4. Patch notes
  source = source.replace(
    /\{showroom\.notes && <p className="mt-3 text-xs text-muted-foreground">\{showroom\.notes\}<\/p>\}/g,
    '{(readShowroomField(siteData?.content, showroom.id, \'notes\', showroom.notes || \'\') || showroom.notes) && (\r\n          <p\r\n            className="mt-3 text-xs text-muted-foreground"\r\n            data-preview-field-path={`showrooms.${showroom.id}.notes`}\r\n            data-preview-style-target={`showrooms.${showroom.id}.notes`}\r\n            data-preview-style-type="text"\r\n          >\r\n            {readShowroomField(siteData?.content, showroom.id, \'notes\', showroom.notes || \'\')}\r\n          </p>\r\n        )}'
  );

  if (!dryRun) {
    fs.writeFileSync(filePath, source, 'utf-8');
    report.fixed.push('components/layout/showroom-card.tsx');
    log('[auto-fix] Saved showroom-card.tsx');
  }
}

function patchSiteFooter(projectDir, dryRun, log, report) {
  const filePath = path.join(projectDir, 'components', 'layout', 'site-footer.tsx');
  if (!fs.existsSync(filePath)) return;

  let source = fs.readFileSync(filePath, 'utf-8');
  if (source.includes('common.showroom.pinIcon')) return;

  log('[auto-fix] Patching site-footer.tsx...');

  if (!source.includes('EditableIcon')) {
    source = source.replace(
      /from "@deneb-ui\/ui";?/,
      ', EditableIcon } from "@deneb-ui/ui";'
    );
  }

  if (!source.includes('readShowroomField')) {
    const helper = [
      '',
      'function readShowroomField(',
      '  content: unknown,',
      '  id: string,',
      '  field: string,',
      '  fallback: string',
      '): string {',
      '  const showrooms = (content as Record<string, unknown> | undefined)?.showrooms as Record<string, unknown> | undefined;',
      '  const entry = showrooms?.[id] as Record<string, unknown> | undefined;',
      '  const val = entry?.[field];',
      '  return typeof val === "string" && val ? val : fallback;',
      '}',
      '',
    ].join('\r\n');
    source = source.replace(
      /\r?\nexport function SiteFooter\(/,
      '\r\n' + helper + '\r\nexport function SiteFooter('
    );
  }

  source = source.replace(
    /<MapPinIcon[^>]*data-preview-static="decorative-icon"[^>]*\/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mt-0.5 shrink-0 text-primary" data-preview-field-path="common.showroom.pinIcon" title="Click to edit showroom pin icon"><EditableIcon name={(siteData?.content?.common as any)?.showroom?.pinIcon ?? "map-pin"} className="size-4" /></span>'
  );

  source = source.replace(
    /<span data-preview-static="decorative-copy">[\s\S]*?<span className="text-foreground">\{s\.name\}<\/span> — \{s\.addressLines\.join\(", "\)\}[\s\S]*?<\/span>/g,
    '<span><span className="text-foreground" data-preview-field-path={`showrooms.${s.id}.name`} data-preview-style-target={`showrooms.${s.id}.name`} data-preview-style-type="text">{readShowroomField(siteData?.content, s.id, "name", s.name)}</span>{" — "}<span data-preview-field-path={`showrooms.${s.id}.address`} data-preview-style-target={`showrooms.${s.id}.address`} data-preview-style-type="text">{readShowroomField(siteData?.content, s.id, "address", s.addressLines.join(", "))}</span></span>'
  );

  if (!dryRun) {
    fs.writeFileSync(filePath, source, 'utf-8');
    report.fixed.push('components/layout/site-footer.tsx');
    log('[auto-fix] Saved site-footer.tsx');
  }
}

function patchUniversalIcons(projectDir, dryRun, log, report) {
  try {
    const { patchUniversalIcons: runPatcher } = require('./universal-icon-patcher.cjs');
    runPatcher(projectDir, dryRun, log);
  } catch (err) {
    log('[auto-fix] Universal icon scan warning: ' + err.message);
  }
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Main entry point: applies all auto-editability fixes to a project.
 *
 * @param {string} projectDir  - Absolute path to the project root.
 * @param {{ dryRun?: boolean, verbose?: boolean }} options
 * @returns {{ fixed: string[], siteDataUpdated: boolean, recipeUpdated: boolean, errors: string[] }}
 */
function runAutoEditabilityFix(projectDir, options) {
  const dryRun = !!(options && options.dryRun);
  const verbose = !!(options && options.verbose);
  const log = verbose ? console.log : function () {};
  const report = { fixed: [], siteDataUpdated: false, recipeUpdated: false, errors: [] };

  // ── 1. Read project data ──────────────────────────────────────────────────
  const vehicles = readVehiclesFromProject(projectDir);
  const showrooms = readShowroomsFromProject(projectDir);
  const bodyData = readBodyTypesFromProject(projectDir);
  const bodyTypes = bodyData.bodyTypes;
  const bodyTypeDescriptions = bodyData.descriptions;

  log('[auto-fix] Found ' + vehicles.length + ' vehicles, ' + showrooms.length + ' showrooms, ' + bodyTypes.length + ' body types');

  const makes = [];
  const makeSeen = new Set();
  for (const v of vehicles) {
    if (v.status !== 'Sold' && !makeSeen.has(v.make)) {
      makeSeen.add(v.make);
      makes.push(v.make);
    }
  }

  // ── 2. Fix component files ────────────────────────────────────────────────
  patchVehicleCollections(projectDir, dryRun, log, report);
  patchShowroomCard(projectDir, dryRun, log, report);
  patchSiteFooter(projectDir, dryRun, log, report);
  patchUniversalIcons(projectDir, dryRun, log, report);

  // ── 3. Update site-data.json ───────────────────────────────────────────────
  const siteDataPath = path.join(projectDir, 'data', 'site-data.json');
  if (fs.existsSync(siteDataPath)) {
    const siteData = readJsonSafe(siteDataPath, {});
    if (!siteData.content) siteData.content = {};
    let changed = false;

    // Ensure cards section exists
    if (!siteData.content.cards || typeof siteData.content.cards !== 'object') {
      siteData.content.cards = {};
    }

    // cards.vehicles — add missing entries, preserve existing overrides
    if (!siteData.content.cards.vehicles) siteData.content.cards.vehicles = {};
    const newVehicleEntries = generateVehicleCardEntries(vehicles);
    for (const id of Object.keys(newVehicleEntries)) {
      if (!siteData.content.cards.vehicles[id]) {
        siteData.content.cards.vehicles[id] = newVehicleEntries[id];
        changed = true;
        log('[auto-fix] Added vehicle card entry: ' + id);
      } else {
        // Add any missing fields to existing entries
        for (const field of Object.keys(newVehicleEntries[id])) {
          if (siteData.content.cards.vehicles[id][field] === undefined) {
            siteData.content.cards.vehicles[id][field] = newVehicleEntries[id][field];
            changed = true;
          }
        }
      }
    }

    // cards.brands
    if (!siteData.content.cards.brands || Object.keys(siteData.content.cards.brands).length === 0) {
      siteData.content.cards.brands = generateBrandCardEntries(vehicles);
      changed = true;
      log('[auto-fix] Added cards.brands entries');
    }

    // cards.bodyTypes
    if (!siteData.content.cards.bodyTypes || Object.keys(siteData.content.cards.bodyTypes).length === 0) {
      siteData.content.cards.bodyTypes = generateBodyTypeEntries(bodyTypes, bodyTypeDescriptions);
      changed = true;
      log('[auto-fix] Added cards.bodyTypes entries');
    }

    // showrooms
    if (!siteData.content.showrooms || Object.keys(siteData.content.showrooms).length === 0) {
      siteData.content.showrooms = generateShowroomEntries(showrooms);
      changed = true;
      log('[auto-fix] Added showrooms entries');
    }

    // photos.vehicles
    if (!siteData.content.photos || typeof siteData.content.photos !== 'object') {
      siteData.content.photos = {};
    }
    if (!siteData.content.photos.vehicles || Object.keys(siteData.content.photos.vehicles).length === 0) {
      siteData.content.photos.vehicles = generateVehiclePhotoEntries(vehicles);
      changed = true;
      log('[auto-fix] Added photos.vehicles entries');
    } else {
      for (const v of vehicles) {
        if (!siteData.content.photos.vehicles[v.id]) {
          siteData.content.photos.vehicles[v.id] = { image0: '' };
          changed = true;
        }
      }
    }

    if (changed && !dryRun) {
      writeJson(siteDataPath, siteData);
      report.siteDataUpdated = true;
      report.fixed.push('data/site-data.json');
      log('[auto-fix] Saved site-data.json');
    }
  }

  // ── 4. Update ARC recipe ───────────────────────────────────────────────────
  const recipesDir = path.join(projectDir, '.deneb', 'recipes');
  if (fs.existsSync(recipesDir)) {
    const recipeFiles = fs.readdirSync(recipesDir).filter((f) => f.endsWith('.json'));
    for (const recipeFile of recipeFiles) {
      const recipePath = path.join(recipesDir, recipeFile);
      const recipe = readJsonSafe(recipePath, {});
      if (!recipe.sections) recipe.sections = [];

      // Remove and re-add managed sections (keeps them up-to-date)
      recipe.sections = removeManagedSections(recipe.sections);
      recipe.sections.push(buildVehicleCardRecipeSection(vehicles));
      recipe.sections.push(buildBrandCardRecipeSection(makes));
      recipe.sections.push(buildBodyTypeRecipeSection(bodyTypes));
      if (showrooms.length > 0) recipe.sections.push(buildShowroomRecipeSection(showrooms));
      recipe.sections.push(buildVehiclePhotosRecipeSection(vehicles));
      recipe.sections.push(buildBenefitsRecipeSection());

      if (!dryRun) {
        writeJson(recipePath, recipe);
        report.recipeUpdated = true;
        report.fixed.push('.deneb/recipes/' + recipeFile);
        log('[auto-fix] Updated recipe: ' + recipeFile);
      }
    }
  }


  // ── 5. Update fivora-template.json manifest editorSchema ──────────────────
  const manifestPath = path.join(projectDir, 'fivora-template.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = readJsonSafe(manifestPath, {});
    if (!manifest.editorSchema) manifest.editorSchema = { version: 1, sections: [] };
    if (!Array.isArray(manifest.editorSchema.sections)) manifest.editorSchema.sections = [];

    manifest.editorSchema.sections = removeManagedSections(manifest.editorSchema.sections);
    manifest.editorSchema.sections.push(buildVehicleCardRecipeSection(vehicles));
    manifest.editorSchema.sections.push(buildBrandCardRecipeSection(makes));
    manifest.editorSchema.sections.push(buildBodyTypeRecipeSection(bodyTypes));
    if (showrooms.length > 0) manifest.editorSchema.sections.push(buildShowroomRecipeSection(showrooms));
    manifest.editorSchema.sections.push(buildVehiclePhotosRecipeSection(vehicles));
    manifest.editorSchema.sections.push(buildBenefitsRecipeSection());

    if (!dryRun) {
      writeJson(manifestPath, manifest);
      report.fixed.push('fivora-template.json');
      log('[auto-fix] Updated fivora-template.json editorSchema');
    }
  }

  return report;
}

module.exports = {
  runAutoEditabilityFix,
  readVehiclesFromProject,
  readShowroomsFromProject,
  readBodyTypesFromProject,
  generateVehicleCardEntries,
  generateBrandCardEntries,
  generateBodyTypeEntries,
  generateShowroomEntries,
  generateVehiclePhotoEntries,
  buildVehicleCardRecipeSection,
  buildBrandCardRecipeSection,
  buildBodyTypeRecipeSection,
  buildShowroomRecipeSection,
  buildVehiclePhotosRecipeSection,
  buildGenericCardRecipeSection,
  slugify,
};
