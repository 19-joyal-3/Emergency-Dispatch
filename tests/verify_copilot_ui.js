import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const screenshotsDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\7d25f4b5-0978-482c-a437-ca6b0c730666\\screenshots';

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function runVerification() {
  console.log('Connecting to http://localhost:5173...');

  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Screenshot 1: Main screen with floating badge
    const screenshot1Path = path.join(screenshotsDir, 'copilot_launcher_on_screen.png');
    await page.screenshot({ path: screenshot1Path });
    console.log('Saved screenshot 1:', screenshot1Path);

    // Click the floating button or AI Copilot chip
    const fab = await page.$('.copilot-floating-badge');
    if (fab) {
      console.log('Found .copilot-floating-badge, clicking it...');
      await fab.click();
      await new Promise(r => setTimeout(r, 1500));
    } else {
      console.log('Could not find .copilot-floating-badge, checking .ai-copilot-chip...');
      const chip = await page.$('.ai-copilot-chip');
      if (chip) {
        console.log('Found .ai-copilot-chip, clicking it...');
        await chip.click();
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Screenshot 2: AI Copilot Modal open
    const screenshot2Path = path.join(screenshotsDir, 'copilot_modal_opened.png');
    await page.screenshot({ path: screenshot2Path });
    console.log('Saved screenshot 2:', screenshot2Path);

    // Wait for input or preset button
    try {
      const input = await page.waitForSelector('input[placeholder*="Ask anything"]', { timeout: 4000 });
      if (input) {
        console.log('Typing query into copilot input...');
        await input.type('Who created Resylix?');
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2000));

        const screenshot3Path = path.join(screenshotsDir, 'copilot_modal_answered.png');
        await page.screenshot({ path: screenshot3Path });
        console.log('Saved screenshot 3:', screenshot3Path);
      }
    } catch (e) {
      console.warn('Could not find input by placeholder:', e.message);
      // Fallback: try clicking first preset topic button
      const topicBtn = await page.$('button[style*="border-radius: 999px"]');
      if (topicBtn) {
        console.log('Clicking preset topic button...');
        await topicBtn.click();
        await new Promise(r => setTimeout(r, 2000));
        const screenshot3Path = path.join(screenshotsDir, 'copilot_modal_answered.png');
        await page.screenshot({ path: screenshot3Path });
        console.log('Saved screenshot 3:', screenshot3Path);
      }
    }

    await browser.close();
  } catch (err) {
    console.error('Puppeteer error:', err);
  } finally {
    process.exit(0);
  }
}

runVerification();
