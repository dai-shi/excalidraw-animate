import { test, expect } from '@playwright/test';

test.describe('Basic UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with main UI elements', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('button', { name: /🌙|☀️/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load File' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Load Library' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Animate!' })).toBeVisible();
  });

  test('can switch between Edit and Animate modes', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('button', { name: 'Animate' })).toBeVisible();

    await page.getByRole('button', { name: 'Animate' }).click();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  });

  test('can toggle theme', async ({ page }) => {
    const themeButton = page.getByRole('button', { name: /🌙|☀️/ });

    // Default is light mode (shows moon icon)
    await expect(themeButton).toHaveText('🌙');

    await themeButton.click();
    await expect(themeButton).toHaveText('☀️');

    await themeButton.click();
    await expect(themeButton).toHaveText('🌙');
  });
});
