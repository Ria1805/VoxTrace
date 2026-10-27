import { test, expect } from '@playwright/test';
test('original layouts: all pages, upload, evidence and export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'ENTER COMMAND CENTER' })).toBeVisible();
  await page.screenshot({ path: 'test-results/original-landing.png', fullPage: true });
  await page.getByRole('button', { name: 'ENTER COMMAND CENTER' }).click();
  await expect(page.getByRole('heading', { name: 'COMMAND CENTER', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'DOWNLOADED VIDEO PREVIEW INVENTORY' })).toBeVisible();
  await expect(page.getByText('5', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('No scored samples yet.')).toBeVisible();
  await page.screenshot({ path: 'test-results/original-dashboard.png', fullPage: true });
  for (const name of ['Threat Intel', 'SIEM & Alerts', 'Playbook', 'Robustness Lab', 'Models & Eval', 'Settings', 'Team', 'Incident DB', 'Evidence Locker']) {
    await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name, exact: true }).click();
    await expect(page.locator('main h1')).toBeVisible();
    if (name === 'Threat Intel') {
      await expect(page.getByText('IOC match escalation rule')).toBeVisible();
      await expect(page.getByRole('table').getByText('ElevenLabs')).toBeVisible();
    }
    if (name === 'Models & Eval') {
      await expect(page.locator('tbody tr')).toHaveCount(3);
      await expect(page.getByText('Phone-augmented (clean)')).toBeVisible();
      await expect(page.getByText(/0\.940/)).toBeVisible();
    }
    await page.waitForTimeout(350);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Live Analysis', exact: true }).click();
  await page.getByLabel('Audio recording').setInputFiles({ name: 'browser-unscored.wav', mimeType: 'audio/wav', buffer: Buffer.from('synthetic unscorable input') });
  await page.getByRole('button', { name: 'EXECUTE ANALYSIS' }).click();
  await expect(page.getByText('UNSCORED', { exact: true }).first()).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Case Detail', exact: true }).click();
  await expect(page.getByText('CASE FILE #1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Verify Integrity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'STATUS: INTACT' })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Evidence Bundle (JSON)' }).click();
  expect((await downloaded).suggestedFilename()).toContain('VOXTRACE_EVIDENCE_BUNDLE');
  await page.getByRole('navigation').getByRole('button', { name: 'Evidence Locker', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('mobile original dock stays reachable; errors are visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER COMMAND CENTER' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('main h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/original-mobile.png', fullPage: true });
  await page.route('**/api/**', route => route.abort());
  await page.getByRole('navigation').getByRole('button', { name: 'Command Center', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
});

test('video upload shows model availability and the unscored reason', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER COMMAND CENTER' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Live Analysis', exact: true }).click();
  await expect(page.getByText('Audio model: READY')).toBeVisible();
  await expect(page.getByText('Video model: NOT TRAINED')).toBeVisible();
  await page.getByLabel('Phone observable').fill('+910000000000');
  await page.getByLabel('Claimed TTS tool').fill('ElevenLabs');
  await page.getByLabel('Video recording').setInputFiles({
    name: 'unreadable-video.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('not a playable video'),
  });
  await page.getByRole('button', { name: 'EXECUTE ANALYSIS' }).click();
  await expect(page.getByText(/VIDEO UNSCORED: No trained video model is available/)).toBeVisible();
  await expect(page.getByText('phone: +910000000000')).toBeVisible();
  await expect(page.getByText('tts_tool: ElevenLabs')).toBeVisible();
  await expect(page.getByText('Playbook Action Level: MEDIUM')).toBeVisible();
});
