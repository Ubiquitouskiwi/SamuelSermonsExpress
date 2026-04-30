#!/usr/bin/env node
/**
 * Take screenshots of each page for OG/Twitter card metadata and README.
 * Uses Playwright to capture full-page and card-sized (1200x630) screenshots.
 *
 * Usage: npm run screenshots
 * Requires the app to be running on localhost.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.SITE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'public', 'images', 'screenshots');

const PAGES = [
  { name: 'home', path: '/', desc: 'Home page' },
  { name: 'sermons', path: '/sermons', desc: 'Sermons collection' },
  { name: 'about', path: '/about', desc: 'About page' },
  { name: 'feed', path: '/feed', desc: 'Activity feed' },
  { name: 'bookmarks', path: '/bookmarks', desc: 'Bookmarks page' },
  { name: 'contact', path: '/contact', desc: 'Join the team' },
  { name: 'login', path: '/auth/login', desc: 'Login page' },
];

// OG/Twitter card dimensions
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

async function run() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch();

  // Full-page screenshots (desktop viewport)
  const fullPage = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await fullPage.newPage();

  for (const p of PAGES) {
    const url = BASE_URL + p.path;
    console.log(`  Capturing ${p.name} (${url})...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${p.name}-full.png`),
        fullPage: true,
      });
    } catch (err) {
      console.warn(`  Warning: Could not capture ${p.name}: ${err.message}`);
    }
  }

  await fullPage.close();

  // OG card screenshots (1200x630 viewport, no scroll)
  const cardContext = await browser.newContext({ viewport: { width: CARD_WIDTH, height: CARD_HEIGHT } });
  const cardPage = await cardContext.newPage();

  for (const p of PAGES) {
    const url = BASE_URL + p.path;
    console.log(`  Capturing ${p.name} card (${CARD_WIDTH}x${CARD_HEIGHT})...`);
    try {
      await cardPage.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await cardPage.screenshot({
        path: path.join(OUTPUT_DIR, `${p.name}-card.png`),
      });
    } catch (err) {
      console.warn(`  Warning: Could not capture ${p.name} card: ${err.message}`);
    }
  }

  await cardContext.close();
  await browser.close();

  console.log(`\nDone! Screenshots saved to ${OUTPUT_DIR}`);
  console.log('Use the -card.png files for og:image and twitter:image meta tags.');
}

run().catch((err) => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
