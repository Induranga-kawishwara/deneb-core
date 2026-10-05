'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = 'd:/projects/office/deneb/fivora-car-sale';
const siteDataPath = path.join(rootDir, 'data', 'site-data.json');

const siteData = JSON.parse(fs.readFileSync(siteDataPath, 'utf8'));
if (!siteData.content) siteData.content = {};
if (!siteData.content.common) siteData.content.common = {};

// Helper to ensure nested object path exists
function setDeep(obj, pathArr, value) {
  let cur = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    const k = pathArr[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  if (cur[pathArr[pathArr.length - 1]] === undefined) {
    cur[pathArr[pathArr.length - 1]] = value;
  }
}

// 1. Register icons in site-data.json
setDeep(siteData.content, ['common', 'showroom', 'pinIcon'], 'map-pin');
setDeep(siteData.content, ['common', 'showroom', 'clockIcon'], 'clock');
setDeep(siteData.content, ['common', 'showroom', 'navIcon'], 'arrow-up-right');
setDeep(siteData.content, ['common', 'whatsapp', 'copyIcon'], 'copy');
setDeep(siteData.content, ['common', 'whatsapp', 'icon'], 'message-circle');
setDeep(siteData.content, ['common', 'search', 'searchIcon'], 'search');
setDeep(siteData.content, ['common', 'testDrive', 'calendarIcon'], 'calendar');
setDeep(siteData.content, ['common', 'testDrive', 'infoIcon'], 'info');
setDeep(siteData.content, ['common', 'vehicleActions', 'historyIcon'], 'file-text');
setDeep(siteData.content, ['common', 'vehicleActions', 'testDriveIcon'], 'calendar-check');
setDeep(siteData.content, ['common', 'vehicleActions', 'financeIcon'], 'landmark');
setDeep(siteData.content, ['common', 'vehicleActions', 'alertIcon'], 'bell');
setDeep(siteData.content, ['common', 'vehicleActions', 'calculatorIcon'], 'calculator');

if (!siteData.content['trade-in']) siteData.content['trade-in'] = {};
setDeep(siteData.content, ['trade-in', 'cameraIcon'], 'camera');
setDeep(siteData.content, ['trade-in', 'upgradeEstimatorIcon'], 'refresh-cw');
setDeep(siteData.content, ['trade-in', 'step1Icon'], 'car-front');
setDeep(siteData.content, ['trade-in', 'step2Icon'], 'camera');
setDeep(siteData.content, ['trade-in', 'step3Icon'], 'handshake');
setDeep(siteData.content, ['trade-in', 'step4Icon'], 'refresh-cw');

if (!siteData.content.about) siteData.content.about = {};
setDeep(siteData.content, ['about', 'principle1Icon'], 'eye');
setDeep(siteData.content, ['about', 'principle2Icon'], 'scale');
setDeep(siteData.content, ['about', 'principle3Icon'], 'message-circle');
setDeep(siteData.content, ['about', 'principle4Icon'], 'file-search');

if (!siteData.content['source-a-car']) siteData.content['source-a-car'] = {};
setDeep(siteData.content, ['source-a-car', 'step1Icon'], 'clipboard-list');
setDeep(siteData.content, ['source-a-car', 'step2Icon'], 'message-circle');
setDeep(siteData.content, ['source-a-car', 'step3Icon'], 'search');

if (!siteData.content.compare) siteData.content.compare = {};
setDeep(siteData.content, ['compare', 'trophyIcon'], 'trophy');

fs.writeFileSync(siteDataPath, JSON.stringify(siteData, null, 2), 'utf8');
console.log('Updated site-data.json with all icon definitions');

// 2. Patch components/vehicles/vehicle-actions.tsx
{
  const filePath = path.join(rootDir, 'components', 'vehicles', 'vehicle-actions.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (!code.includes('EditableIcon')) {
    code = code.replace(
      /from "@deneb-ui\/ui";?/,
      ', EditableIcon } from "@deneb-ui/ui";'
    );
  }
  // Replace FileTextIcon
  code = code.replace(
    /<FileTextIcon[^>]*data-preview-static="decorative-icon"[^>]*\/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mr-1.5" data-preview-field-path="common.vehicleActions.historyIcon" title="Click to edit history icon"><EditableIcon name={(siteData?.content?.common as any)?.vehicleActions?.historyIcon ?? "file-text"} className="size-4" /></span>'
  );
  // Replace CalendarCheckIcon
  code = code.replace(
    /<CalendarCheckIcon[^>]*data-preview-static="decorative-icon"[^>]*\/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mr-1.5" data-preview-field-path="common.vehicleActions.testDriveIcon" title="Click to edit test drive icon"><EditableIcon name={(siteData?.content?.common as any)?.vehicleActions?.testDriveIcon ?? "calendar-check"} className="size-4" /></span>'
  );
  // Replace LandmarkIcon
  code = code.replace(
    /<LandmarkIcon[^>]*data-preview-static="decorative-icon"[^>]*\/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mr-1.5" data-preview-field-path="common.vehicleActions.financeIcon" title="Click to edit finance icon"><EditableIcon name={(siteData?.content?.common as any)?.vehicleActions?.financeIcon ?? "landmark"} className="size-4" /></span>'
  );
  // Replace BellIcon
  code = code.replace(
    /<BellIcon[^>]*data-preview-static="decorative-icon"[^>]*\/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mr-1.5" data-preview-field-path="common.vehicleActions.alertIcon" title="Click to edit alert icon"><EditableIcon name={(siteData?.content?.common as any)?.vehicleActions?.alertIcon ?? "bell"} className="size-4" /></span>'
  );
  // Replace CalculatorIcon
  code = code.replace(
    /<CalculatorIcon[^>]*data-preview-static="decorative-icon"[^>]*\/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mr-1.5" data-preview-field-path="common.vehicleActions.calculatorIcon" title="Click to edit calculator icon"><EditableIcon name={(siteData?.content?.common as any)?.vehicleActions?.calculatorIcon ?? "calculator"} className="size-4" /></span>'
  );
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Patched components/vehicles/vehicle-actions.tsx');
}

// 3. Patch app/(public)/trade-in/page.tsx
{
  const filePath = path.join(rootDir, 'app', '(public)', 'trade-in', 'page.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (!code.includes('EditableIcon')) {
    code = 'import { EditableIcon } from "@/src/components/ui/EditableIcon";\n' + code;
  }
  code = code.replace(
    /<RefreshCwIcon[^>]*data-preview-static="decorative-icon"[^>]*\/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mr-1.5" data-preview-field-path="trade-in.upgradeEstimatorIcon" title="Click to edit estimator icon"><EditableIcon name={(siteData?.content?.["trade-in"] as any)?.upgradeEstimatorIcon ?? "refresh-cw"} className="size-4" /></span>'
  );
  code = code.replace(
    /<Icon className="size-6 text-primary" aria-hidden data-preview-static="decorative-icon" \/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 text-primary" data-preview-field-path={`trade-in.step${i + 1}Icon`} title="Click to edit step icon"><EditableIcon name={(siteData?.content?.["trade-in"] as any)?.[`step${i + 1}Icon`] ?? ["car-front", "camera", "handshake", "refresh-cw"][i]} className="size-6" /></span>'
  );
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Patched app/(public)/trade-in/page.tsx');
}

// 4. Patch app/(public)/about/page.tsx
{
  const filePath = path.join(rootDir, 'app', '(public)', 'about', 'page.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (!code.includes('EditableIcon')) {
    code = 'import { EditableIcon } from "@/src/components/ui/EditableIcon";\n' + code;
  }
  code = code.replace(
    /<Icon className="mb-4 size-6 text-primary" aria-hidden data-preview-static="decorative-icon" \/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 text-primary mb-4" data-preview-field-path={`about.principle${PRINCIPLES.findIndex(p => p.title === title) + 1}Icon`} title="Click to edit principle icon"><EditableIcon name={(siteData?.content?.about as any)?.[`principle${PRINCIPLES.findIndex(p => p.title === title) + 1}Icon`] ?? ["eye", "scale", "message-circle", "file-search"][PRINCIPLES.findIndex(p => p.title === title)]} className="size-6" /></span>'
  );
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Patched app/(public)/about/page.tsx');
}

// 5. Patch app/(public)/source-a-car/page.tsx
{
  const filePath = path.join(rootDir, 'app', '(public)', 'source-a-car', 'page.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (!code.includes('EditableIcon')) {
    code = 'import { EditableIcon } from "@/src/components/ui/EditableIcon";\n' + code;
  }
  code = code.replace(
    /<Icon className="size-5" aria-hidden data-preview-static="decorative-icon" \/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 text-primary" data-preview-field-path={`source-a-car.step${i + 1}Icon`} title="Click to edit step icon"><EditableIcon name={(siteData?.content?.["source-a-car"] as any)?.[`step${i + 1}Icon`] ?? ["clipboard-list", "message-circle", "search"][i]} className="size-5" /></span>'
  );
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Patched app/(public)/source-a-car/page.tsx');
}

// 6. Patch components/vehicles/compare-view.tsx
{
  const filePath = path.join(rootDir, 'components', 'vehicles', 'compare-view.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (!code.includes('EditableIcon')) {
    code = 'import { EditableIcon } from "@/src/components/ui/EditableIcon";\n' + code;
  }
  code = code.replace(
    /<TrophyIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden data-preview-static="decorative-icon" \/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mt-0.5 shrink-0 text-primary" data-preview-field-path="compare.trophyIcon" title="Click to edit trophy icon"><EditableIcon name={(siteData?.content?.compare as any)?.trophyIcon ?? "trophy"} className="size-5" /></span>'
  );
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Patched components/vehicles/compare-view.tsx');
}

// 7. Patch components/whatsapp/trade-in-form.tsx
{
  const filePath = path.join(rootDir, 'components', 'whatsapp', 'trade-in-form.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (!code.includes('EditableIcon')) {
    code = 'import { EditableIcon } from "@/src/components/ui/EditableIcon";\n' + code;
  }
  code = code.replace(
    /<CameraIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden data-preview-static="decorative-icon" \/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mt-0.5 shrink-0 text-primary" data-preview-field-path="trade-in.cameraIcon" title="Click to edit camera icon"><EditableIcon name={(siteData?.content?.["trade-in"] as any)?.cameraIcon ?? "camera"} className="size-4" /></span>'
  );
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Patched components/whatsapp/trade-in-form.tsx');
}

// 8. Patch components/whatsapp/whatsapp-provider.tsx
{
  const filePath = path.join(rootDir, 'components', 'whatsapp', 'whatsapp-provider.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (!code.includes('EditableIcon')) {
    code = 'import { EditableIcon } from "@/src/components/ui/EditableIcon";\n' + code;
  }
  code = code.replace(
    /<CopyIcon data-icon="inline-start" data-preview-static="decorative-icon" \/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mr-1.5" data-preview-field-path="common.whatsapp.copyIcon" title="Click to edit copy icon"><EditableIcon name={(siteData?.content?.common as any)?.whatsapp?.copyIcon ?? "copy"} className="size-4" /></span>'
  );
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Patched components/whatsapp/whatsapp-provider.tsx');
}

// 9. Patch components/vehicles/quick-search.tsx
{
  const filePath = path.join(rootDir, 'components', 'vehicles', 'quick-search.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (!code.includes('EditableIcon')) {
    code = 'import { EditableIcon } from "@/src/components/ui/EditableIcon";\nimport { useSiteData } from "@deneb-ui/ui";\n' + code;
  }
  if (!code.includes('const siteData = useSiteData();')) {
    code = code.replace(
      /(export function QuickSearch\([^)]*\)\s*\{)/,
      '$1\n  const siteData = useSiteData();'
    );
  }
  code = code.replace(
    /<SearchIcon data-icon="inline-start" data-preview-static="decorative-icon" \/>/g,
    '<span className="inline-flex cursor-pointer transition-transform hover:scale-110 mr-1.5" data-preview-field-path="common.search.searchIcon" title="Click to edit search icon"><EditableIcon name={(siteData?.content?.common as any)?.search?.searchIcon ?? "search"} className="size-4" /></span>'
  );
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Patched components/vehicles/quick-search.tsx');
}

console.log('All files successfully updated with EditableIcon!');
