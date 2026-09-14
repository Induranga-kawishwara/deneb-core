'use strict';

const { execSync } = require('node:child_process');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/verify-npm-lockstep.js <version>');
  process.exit(1);
}

const names = ['@deneb-ui/core', '@deneb-ui/ui', '@deneb-ui/cli', '@deneb-ui/create-template'];
const attempts = Number(process.env.NPM_LOCKSTEP_ATTEMPTS || 20);
const delayMs = Number(process.env.NPM_LOCKSTEP_DELAY_MS || 15000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkPublished(name, ver) {
  // 1. Direct registry check with cache-busting
  try {
    const encoded = name.replace('/', '%2F');
    const url = `https://registry.npmjs.org/${encoded}/${ver}?_t=${Date.now()}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
    if (res.ok) return true;
  } catch {
    // Fall back to npm view
  }

  // 2. Fallback to npm view CLI
  try {
    const out = execSync(`npm view ${name}@${ver} version --no-workspaces --prefer-online`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return out === ver;
  } catch {
    return false;
  }
}

async function main() {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const missing = [];
    for (const name of names) {
      const ok = await checkPublished(name, version);
      if (ok) {
        console.log(`✔ ${name}@${version}`);
      } else {
        missing.push(`${name}@${version}`);
      }
    }

    if (!missing.length) {
      console.log(`\nAll four packages published and verified at v${version}`);
      process.exit(0);
    }

    console.log(
      `Waiting for npm to index (${attempt}/${attempts}): missing ${missing.join(', ')}`,
    );
    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  console.error(
    `npm lockstep failed after ${attempts} attempts. Not visible on the registry yet:\n- ${names
      .filter((name) => !checkPublished(name, version))
      .map((name) => `${name}@${version}`)
      .join('\n- ')}`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

