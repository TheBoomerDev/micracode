import { test, expect } from '@playwright/test';

test.describe('Micracode Workspace', () => {

  test('home page loads correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.locator('h1')).toContainText("Let's Build");
    // Settings button should be visible
    await expect(page.locator('button[title="Settings"]')).toBeVisible();
  });

  test('projects page with id shows workspace', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/?id=preuabs');
    // Should show the project name in header
    await expect(page.locator('text=preuabs')).toBeVisible();
    // Settings button should be visible
    await expect(page.locator('button[title="Settings"]')).toBeVisible();
    // Chat input should be visible
    await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible();
  });

  test('projects page without id shows message', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/');
    await expect(page.locator('text=Missing project id')).toBeVisible();
  });

  test('settings panel opens and closes', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    // Open settings
    await page.click('button[title="Settings"]');
    await expect(page.locator('text=LLM Provider')).toBeVisible();
    // Provider selector should exist
    await expect(page.locator('select')).toBeVisible();
    // Close settings
    await page.click('button:has-text("Close")');
    await expect(page.locator('text=LLM Provider')).not.toBeVisible();
  });

  test('model picker works in chat panel', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/?id=preuabs');
    // The model picker button should be present
    const modelBtn = page.locator('button:has-text("Select model")');
    await expect(modelBtn).toBeVisible();
  });

  test('navigation: breadcrumb link goes home', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/?id=preuabs');
    // Click Micracode breadcrumb
    await page.click('text=Micracode');
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('settings persists provider selection', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    // Open settings
    await page.click('button[title="Settings"]');
    // Change provider
    await page.selectOption('select', 'openai');
    await page.click('button:has-text("Close")');
    // Reload
    await page.reload();
    // Open settings again
    await page.click('button[title="Settings"]');
    // Should show OpenAI API key field
    await expect(page.locator('input[placeholder="sk-..."]')).toBeVisible();
  });

});
