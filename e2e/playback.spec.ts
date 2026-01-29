import { test, expect } from '@playwright/test';
import { STORAGE_KEY, createDrawing } from './testHelpers';

test.describe('Playback Controls', () => {
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
    // Wait for SVG to be generated (playback buttons appear)
    await expect(page.getByRole('button', { name: /Pause \(P\)/ })).toBeVisible(
      {
        timeout: 10000,
      },
    );
  });

  test('PLAY-001: Play button starts animation', async ({ page }) => {
    // Initially animation is playing (shows Pause button)
    await expect(page.getByRole('button', { name: 'Pause (P)' })).toBeVisible();

    // Pause first
    await page.getByRole('button', { name: 'Pause (P)' }).click();
    await expect(page.getByRole('button', { name: 'Play (P)' })).toBeVisible();

    // Click Play
    await page.getByRole('button', { name: 'Play (P)' }).click();
    await expect(page.getByRole('button', { name: 'Pause (P)' })).toBeVisible();
  });

  test('PLAY-002: Pause button pauses animation', async ({ page }) => {
    // Initially animation is playing
    await expect(page.getByRole('button', { name: 'Pause (P)' })).toBeVisible();

    // Click Pause
    await page.getByRole('button', { name: 'Pause (P)' }).click();

    // Should show Play button
    await expect(page.getByRole('button', { name: 'Play (P)' })).toBeVisible();
  });

  test('PLAY-003: P key toggles play/pause', async ({ page }) => {
    // Initially playing
    await expect(page.getByRole('button', { name: 'Pause (P)' })).toBeVisible();

    // Press P to pause
    await page.keyboard.press('p');
    await expect(page.getByRole('button', { name: 'Play (P)' })).toBeVisible();

    // Press P to play
    await page.keyboard.press('p');
    await expect(page.getByRole('button', { name: 'Pause (P)' })).toBeVisible();
  });

  test('PLAY-004: Step button advances animation', async ({ page }) => {
    // Pause animation first
    await page.getByRole('button', { name: 'Pause (P)' }).click();
    await expect(page.getByRole('button', { name: 'Play (P)' })).toBeVisible();

    // Click Step - animation should advance and remain paused
    await page.getByRole('button', { name: 'Step (S)' }).click();

    // After stepping, it should still show Play (paused state)
    // Wait a bit for the step animation to complete
    await page.waitForTimeout(600);
    await expect(page.getByRole('button', { name: 'Play (P)' })).toBeVisible();
  });

  test('PLAY-005: S key steps animation', async ({ page }) => {
    // Pause animation first
    await page.keyboard.press('p');
    await expect(page.getByRole('button', { name: 'Play (P)' })).toBeVisible();

    // Press S to step
    await page.keyboard.press('s');

    // Wait for step to complete
    await page.waitForTimeout(600);
    await expect(page.getByRole('button', { name: 'Play (P)' })).toBeVisible();
  });

  test('PLAY-006: Reset button resets animation', async ({ page }) => {
    // Verify Reset button exists and is clickable
    const resetButton = page.getByRole('button', { name: 'Reset (R)' });
    await expect(resetButton).toBeVisible();

    // Click Reset
    await resetButton.click();

    // Reset button should still be visible (animation controls remain)
    await expect(resetButton).toBeVisible();
  });

  test('PLAY-007: R key resets animation', async ({ page }) => {
    // Verify Reset button exists
    await expect(page.getByRole('button', { name: 'Reset (R)' })).toBeVisible();

    // Press R to reset
    await page.keyboard.press('r');

    // Controls should still be visible
    await expect(page.getByRole('button', { name: 'Reset (R)' })).toBeVisible();
  });

  test('PLAY-008: Hide Toolbar button hides toolbar', async ({ page }) => {
    // Verify toolbar is visible
    await expect(
      page.getByRole('button', { name: 'Hide Toolbar (Q)' }),
    ).toBeVisible();

    // Click Hide Toolbar
    await page.getByRole('button', { name: 'Hide Toolbar (Q)' }).click();

    // Toolbar should be hidden
    await expect(
      page.getByRole('button', { name: 'Hide Toolbar (Q)' }),
    ).not.toBeVisible();
  });

  test('PLAY-009: Q key hides toolbar', async ({ page }) => {
    // Verify toolbar is visible
    await expect(
      page.getByRole('button', { name: 'Hide Toolbar (Q)' }),
    ).toBeVisible();

    // Press Q to hide toolbar
    await page.keyboard.press('q');

    // Toolbar should be hidden
    await expect(
      page.getByRole('button', { name: 'Hide Toolbar (Q)' }),
    ).not.toBeVisible();
  });

  test('PLAY-010: Show toolbar after hide via any key', async ({ page }) => {
    // Hide toolbar first
    await page.keyboard.press('q');
    await expect(
      page.getByRole('button', { name: 'Hide Toolbar (Q)' }),
    ).not.toBeVisible();

    // Press any key (except q) to show toolbar
    await page.keyboard.press('a');

    // Toolbar should be visible again
    await expect(
      page.getByRole('button', { name: 'Hide Toolbar (Q)' }),
    ).toBeVisible();
  });
});

test.describe('Playback Controls - No Data', () => {
  test('Playback buttons not visible without drawing data', async ({
    page,
  }) => {
    // Fresh page without any drawing data
    await page.goto('/');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
    await page.reload();

    // Wait for page to stabilize
    await expect(page.getByRole('button', { name: 'Load File' })).toBeVisible();

    // Playback buttons should not be visible
    await expect(
      page.getByRole('button', { name: /Play|Pause/ }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Step (S)' }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Reset (R)' }),
    ).not.toBeVisible();
  });
});
