import { test, expect, Page } from '@playwright/test';
import {
  STORAGE_KEY,
  createDrawing,
} from '../src/__testHelpers/creationForTests';

async function openAnimatePanel(page: Page) {
  // Open the Animate Panel sidebar if not already open
  const animationHeading = page.getByText('Animation');
  const isVisible = await animationHeading.isVisible().catch(() => false);
  if (!isVisible) {
    // First, close any open sidebar (like library)
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('.layer-ui__wrapper button');
      buttons.forEach((btn) => {
        if (
          btn.classList.contains('sidebar-trigger') &&
          btn.getAttribute('aria-pressed') === 'true'
        ) {
          (btn as HTMLElement).click();
        }
      });
    });
    await page.waitForTimeout(300);

    // Then click Toggle Animate Panel button
    await page.evaluate(() => {
      const triggers = document.querySelectorAll('.sidebar-trigger');
      triggers.forEach((trigger) => {
        const label = trigger.querySelector('.sidebar-trigger__label');
        if (label && label.textContent?.includes('Toggle Animate Panel')) {
          (trigger as HTMLElement).click();
        }
      });
    });
    await page.waitForTimeout(500);
  }
  await expect(animationHeading).toBeVisible({ timeout: 10000 });
}

test.describe('AnimateConfig', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Load drawing data into localStorage
    const drawing = createDrawing('Test', 'test-element-1');
    await page.goto('/');
    await page.evaluate(
      ({ key, data }) => {
        localStorage.setItem(key, JSON.stringify(data));
      },
      { key: STORAGE_KEY, data: drawing },
    );
    await page.reload();

    // Switch to Edit mode
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('button', { name: 'Animate' })).toBeVisible();

    // Wait for Excalidraw to fully load
    await page.waitForTimeout(1000);

    // Open animate panel
    await openAnimatePanel(page);
  });

  test('CFG-003: Inputs disabled when no selection', async ({ page }) => {
    const orderInput = page.locator('input[title="Set animation order"]');
    const durationInput = page.locator(
      'input[title="Set animation duration in milliseconds"]',
    );

    // Both inputs should be disabled when no element is selected
    await expect(orderInput).toBeDisabled();
    await expect(durationInput).toBeDisabled();
  });

  test('CFG-009: Pointer URL input available', async ({ page }) => {
    // Pointer URL input should be visible
    const pointerInput = page.locator(
      'input[placeholder="Enter URL or choose a File..."]',
    );
    await expect(pointerInput).toBeVisible();

    // Enter a URL
    await pointerInput.fill('https://example.com/pointer.png');

    // Value should be set
    await expect(pointerInput).toHaveValue('https://example.com/pointer.png');
  });

  test('CFG-010: Pointer file upload button available', async ({ page }) => {
    // File upload button should be visible
    const fileButton = page.locator('label[for="pointerFile"]');
    await expect(fileButton).toBeVisible();
    await expect(fileButton).toHaveText('File...');

    // Hidden file input should exist
    const fileInput = page.locator('input#pointerFile[type="file"]');
    await expect(fileInput).toBeAttached();
  });

  test('CFG-011: Pointer width input available', async ({ page }) => {
    // Pointer width input should be visible
    const widthInput = page.locator(
      'input[title="Enter pointer width in pixels"]',
    );
    await expect(widthInput).toBeVisible();

    // Enter width value
    await widthInput.fill('50');

    // Value should be set
    await expect(widthInput).toHaveValue('50');
  });
});

test.describe('AnimateConfig - No Data', () => {
  test('AnimateConfig visible in Edit mode without drawing', async ({
    page,
  }) => {
    // Fresh page
    await page.goto('/');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
    await page.reload();

    // Switch to Edit mode
    await page.getByRole('button', { name: 'Edit' }).click();

    // Wait for Excalidraw to fully load
    await page.waitForTimeout(1000);

    // Open animate panel
    await openAnimatePanel(page);

    // AnimateConfig sections should still be visible
    await expect(page.getByText('Animation')).toBeVisible();
    await expect(page.getByText('Pointer')).toBeVisible();

    // Inputs should be disabled (no elements to select)
    const orderInput = page.locator('input[title="Set animation order"]');
    await expect(orderInput).toBeDisabled();
  });
});
