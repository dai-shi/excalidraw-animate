import { test, expect } from '@playwright/test';

test.describe('File Loading Error', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ERR-001: Invalid link format disables Animate button', async ({
    page,
  }) => {
    const linkInput = page.locator('input[placeholder="Enter link..."]');
    const animateButton = page.locator('button[type="submit"]', {
      hasText: 'Animate!',
    });

    // Various invalid link formats should keep button disabled
    const invalidLinks = [
      'invalid-link',
      'https://invalid-url.com',
      'random text',
      'json=abc123', // missing #
      '#json', // missing =
    ];

    for (const link of invalidLinks) {
      await linkInput.fill(link);
      await expect(animateButton).toBeDisabled();
    }
  });

  test('ERR-001b: Valid format link enables Animate button', async ({
    page,
  }) => {
    const linkInput = page.locator('input[placeholder="Enter link..."]');
    const animateButton = page.locator('button[type="submit"]', {
      hasText: 'Animate!',
    });

    // Initially disabled
    await expect(animateButton).toBeDisabled();

    // Enter valid format (#json=...)
    await linkInput.fill('#json=abc123');

    // Button should be enabled
    await expect(animateButton).toBeEnabled();
  });

  test('ERR-001c: Valid excalidrawlib URL enables Animate button', async ({
    page,
  }) => {
    const linkInput = page.locator('input[placeholder="Enter link..."]');
    const animateButton = page.locator('button[type="submit"]', {
      hasText: 'Animate!',
    });

    // Enter valid .excalidrawlib URL
    await linkInput.fill('https://example.com/library.excalidrawlib');

    // Button should be enabled
    await expect(animateButton).toBeEnabled();
  });

  test('ERR-004: Empty link keeps Animate button disabled', async ({
    page,
  }) => {
    const linkInput = page.locator('input[placeholder="Enter link..."]');
    const animateButton = page.locator('button[type="submit"]', {
      hasText: 'Animate!',
    });

    // Empty input
    await linkInput.fill('');

    // Button should be disabled
    await expect(animateButton).toBeDisabled();

    // Type something then clear
    await linkInput.fill('test');
    await linkInput.fill('');

    // Still disabled
    await expect(animateButton).toBeDisabled();
  });

  test('ERR-004b: Whitespace-only link keeps Animate button disabled', async ({
    page,
  }) => {
    const linkInput = page.locator('input[placeholder="Enter link..."]');
    const animateButton = page.locator('button[type="submit"]', {
      hasText: 'Animate!',
    });

    // Whitespace only
    await linkInput.fill('   ');

    // Button should be disabled
    await expect(animateButton).toBeDisabled();
  });
});

test.describe('File Loading - Link Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Link regex validates #json= format', async ({ page }) => {
    const linkInput = page.locator('input[placeholder="Enter link..."]');
    const animateButton = page.locator('button[type="submit"]', {
      hasText: 'Animate!',
    });

    // Valid formats
    const validLinks = [
      '#json=abc123',
      '#json=ABC_def-123',
      '#json=test,key123',
    ];

    for (const link of validLinks) {
      await linkInput.fill(link);
      await expect(animateButton).toBeEnabled();
    }

    // Invalid formats
    const invalidLinks = [
      'json=abc123', // missing #
      '#json', // missing =
      '#json=', // missing id
      'random text',
      'https://example.com', // not .excalidrawlib
    ];

    for (const link of invalidLinks) {
      await linkInput.fill(link);
      await expect(animateButton).toBeDisabled();
    }
  });

  test('Link regex validates .excalidrawlib URL format', async ({ page }) => {
    const linkInput = page.locator('input[placeholder="Enter link..."]');
    const animateButton = page.locator('button[type="submit"]', {
      hasText: 'Animate!',
    });

    // Valid .excalidrawlib URLs
    const validUrls = [
      'https://example.com/lib.excalidrawlib',
      'http://localhost/test.excalidrawlib',
      'https://gist.github.com/user/abc123.excalidrawlib',
    ];

    for (const url of validUrls) {
      await linkInput.fill(url);
      await expect(animateButton).toBeEnabled();
    }

    // Invalid URLs (not .excalidrawlib)
    const invalidUrls = [
      'https://example.com/file.json',
      'https://example.com/excalidrawlib', // missing dot
      'ftp://example.com/lib.excalidrawlib', // not http/https
    ];

    for (const url of invalidUrls) {
      await linkInput.fill(url);
      await expect(animateButton).toBeDisabled();
    }
  });
});
