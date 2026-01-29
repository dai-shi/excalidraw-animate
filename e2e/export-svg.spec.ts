import { test, expect } from '@playwright/test';
import { STORAGE_KEY, createDrawing } from './testHelpers';

test.describe('Export SVG Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Load drawing data into localStorage and reload
    const drawing = createDrawing('Test', 'test-element-1');
    await page.goto('/');
    await page.evaluate(
      ({ key, data }) => {
        localStorage.setItem(key, JSON.stringify(data));
      },
      { key: STORAGE_KEY, data: drawing },
    );
    await page.reload();
    // Wait for SVG to be generated (Export to SVG button appears)
    await expect(
      page.getByRole('button', { name: 'Export to SVG' }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('EXP-001: opens modal via button click', async ({ page }) => {
    await page.getByRole('button', { name: 'Export to SVG' }).click();

    // Modal should be visible with title and toggles
    await expect(page.getByText('Export to SVG').first()).toBeVisible();
    await expect(page.getByText('Background')).toBeVisible();
    await expect(page.getByText('Dark mode')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Export', exact: true }),
    ).toBeVisible();
  });

  test('EXP-002: closes modal via Escape key', async ({ page }) => {
    await page.getByRole('button', { name: 'Export to SVG' }).click();
    await expect(page.getByText('Background')).toBeVisible();

    await page.keyboard.press('Escape');

    // Modal should be closed
    await expect(page.getByText('Background')).not.toBeVisible();
  });

  test('EXP-003: closes modal via overlay click', async ({ page }) => {
    await page.getByRole('button', { name: 'Export to SVG' }).click();
    await expect(page.getByText('Background')).toBeVisible();

    // Click on the overlay (outside the modal panel)
    await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } });

    // Modal should be closed
    await expect(page.getByText('Background')).not.toBeVisible();
  });

  test('EXP-004: toggles Background setting', async ({ page }) => {
    await page.getByRole('button', { name: 'Export to SVG' }).click();

    const backgroundToggle = page.getByRole('button', {
      name: 'Toggle background',
    });

    // Initial state: Background OFF (check title attribute)
    await expect(backgroundToggle).toHaveAttribute(
      'title',
      'Background disabled',
    );

    // Toggle ON
    await backgroundToggle.click();
    await expect(backgroundToggle).toHaveAttribute(
      'title',
      'Background enabled',
    );

    // Toggle OFF
    await backgroundToggle.click();
    await expect(backgroundToggle).toHaveAttribute(
      'title',
      'Background disabled',
    );
  });

  test('EXP-005: toggles Dark mode setting', async ({ page }) => {
    await page.getByRole('button', { name: 'Export to SVG' }).click();

    const darkModeToggle = page.getByRole('button', {
      name: 'Toggle dark mode',
    });

    // Initial state depends on app theme (light mode = Light mode title)
    await expect(darkModeToggle).toHaveAttribute('title', 'Light mode');

    // Toggle to Dark
    await darkModeToggle.click();
    await expect(darkModeToggle).toHaveAttribute('title', 'Dark mode');

    // Toggle back to Light
    await darkModeToggle.click();
    await expect(darkModeToggle).toHaveAttribute('title', 'Light mode');
  });

  test('EXP-006: Export button closes modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Export to SVG' }).click();
    await expect(page.getByText('Background')).toBeVisible();

    // Click Export button (exact match to avoid matching "Export to SVG")
    await page.getByRole('button', { name: 'Export', exact: true }).click();

    // Modal should close after export
    await expect(page.getByText('Background')).not.toBeVisible();
  });
});

test.describe('Export SVG Modal - No Data', () => {
  test('EXP-010: Export button hidden without drawing data', async ({
    page,
  }) => {
    // Fresh page without any drawing data
    await page.goto('/');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
    await page.reload();

    // Export to SVG button should not be visible
    await expect(
      page.getByRole('button', { name: 'Export to SVG' }),
    ).not.toBeVisible();
  });
});
