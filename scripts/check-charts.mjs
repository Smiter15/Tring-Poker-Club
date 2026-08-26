import { chromium } from '@playwright/test';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch({
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

const viewportWidth = Number(process.env.VIEWPORT_WIDTH ?? 1440);
const page = await browser.newPage({
  viewport: { width: viewportWidth, height: viewportWidth < 600 ? 844 : 1000 },
});
const runtimeErrors = [];

page.on('console', (message) => {
  const isChartWarning =
    message.type() === 'warning' &&
    message.text().includes('Highcharts warning');
  if (message.type() === 'error' || isChartWarning)
    runtimeErrors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));

const checks = [
  { path: '/players', expectedCharts: 0 },
  { path: '/seasons/6', expectedCharts: 1 },
  { path: '/seasons/6/review', expectedCharts: 1 },
  { path: '/players/ben-sinclair', expectedCharts: 1 },
];
let failed = false;

for (const check of checks) {
  runtimeErrors.length = 0;
  await page.goto(`${baseUrl}${check.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1_000);
  const chartCount = await page.locator('.highcharts-container').count();
  const visualChecks = {};
  if (check.path === '/players') {
    await page.locator('#player-search').fill('The Founder');
    const founderCount = await page
      .locator('a[href="/players/ben-sinclair"]')
      .count();
    await page.locator('#player-search').fill('');
    await page.locator('#player-filter').selectOption('season-champions');
    const championCount = await page.locator('a[href^="/players/"]').count();
    await page.locator('#player-filter').selectOption('all');
    if (founderCount !== 1 || championCount === 0) failed = true;
  }
  if (check.path === '/seasons/6') {
    const crown = page.locator('[aria-label="Champion"]').first();
    const crownStyle = await crown.evaluate((element) => ({
      color: getComputedStyle(element).color,
      width: Number.parseFloat(getComputedStyle(element).width),
    }));
    const initials = page.locator('span[role="img"] > span').first();
    const initialsSize = await initials.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    visualChecks.crown = crownStyle;
    visualChecks.initialsSize = initialsSize;
    if (crownStyle.color !== 'rgb(255, 201, 40)' || crownStyle.width < 30) {
      failed = true;
    }
    if (initialsSize < 20) failed = true;
  }
  if (check.path === '/seasons/6/review') {
    const realAvatarLabel = page
      .locator('div.highcharts-xaxis-labels > span')
      .filter({ hasText: 'Coach' })
      .first();
    const avatarLayout = await realAvatarLabel.evaluate((element) => ({
      hasPhoto: [...element.querySelectorAll('span')].some((avatar) =>
        getComputedStyle(avatar).backgroundImage.includes('coach.jpeg'),
      ),
      width: element.getBoundingClientRect().width,
      scrollWidth: element.scrollWidth,
    }));
    visualChecks.realAvatar = avatarLayout;
    if (
      !avatarLayout.hasPhoto ||
      avatarLayout.width < avatarLayout.scrollWidth
    ) {
      failed = true;
    }
  }
  if (chartCount !== check.expectedCharts || runtimeErrors.length > 0) {
    failed = true;
  }
  console.log(
    JSON.stringify({
      path: check.path,
      chartCount,
      expectedCharts: check.expectedCharts,
      visualChecks,
      runtimeErrors,
    }),
  );

  if (process.env.SCREENSHOT_DIR) {
    const filename =
      check.path.replaceAll('/', '-').replace(/^-/, '') || 'home';
    await page.screenshot({
      path: `${process.env.SCREENSHOT_DIR}/${filename}.png`,
      fullPage: true,
    });
  }
}

await browser.close();
if (failed) process.exitCode = 1;
