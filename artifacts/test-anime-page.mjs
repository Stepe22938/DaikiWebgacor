import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.stack || err.message));
  
  try {
    console.log('Navigating to http://localhost:5173/anime...');
    await page.goto('http://localhost:5173/anime', { waitUntil: 'networkidle2', timeout: 10000 });
    console.log('Page loaded. Waiting 5 seconds to capture potential loops...');
    await new Promise(r => setTimeout(r, 5000));
  } catch (e) {
    console.error('Navigation error:', e.message);
  } finally {
    await browser.close();
    console.log('Done.');
  }
})();
