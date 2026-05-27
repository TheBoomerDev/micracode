import { test, expect } from '@playwright/test';

test.describe('Micracode Workspace', () => {

  test('home page loads correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.locator('h1')).toContainText("Let's Build");
    await expect(page.locator('button[title="Settings"]')).toBeVisible();
  });

  test('projects page with id shows workspace', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/?id=preuabs');
    await expect(page.locator('text=preuabs')).toBeVisible();
    await expect(page.locator('button[title="Settings"]')).toBeVisible();
    // Chat input should be visible
    await expect(page.getByPlaceholder('Describe what you want to build...')).toBeVisible();
  });

  test('projects page without id shows message', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/');
    await expect(page.locator('text=Missing project id')).toBeVisible();
  });

  test('settings panel opens with dynamic model picker', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    // Open settings
    await page.click('button[title="Settings"]');
    // Wait for panel to appear
    await expect(page.locator('text=LLM Provider')).toBeVisible({ timeout: 3000 });
    // Provider selector should exist
    await expect(page.locator('select')).toBeVisible();
    // API key input should exist for default provider (gemini)
    await expect(page.locator('input[placeholder="AIza..."]')).toBeVisible();
    // Model section should exist (label with "Model" text)
    await expect(page.getByText('Model', { exact: true })).toBeVisible();
    // Output directory field should exist
    await expect(page.locator('text=Output Directory')).toBeVisible();
    // Close settings
    await page.click('button:has-text("Close")');
    await expect(page.locator('text=LLM Provider')).not.toBeVisible();
  });

  test('workspace has docs and git action buttons', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/?id=preuabs');
    // Docs button should be visible
    await expect(page.locator('button:has-text("Docs")')).toBeVisible();
    // Git button should be visible
    await expect(page.locator('button:has-text("Git")')).toBeVisible();
  });

  test('model picker works in chat panel', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/?id=preuabs');
    const modelBtn = page.locator('button:has-text("Select model")');
    await expect(modelBtn).toBeVisible();
  });

  test('navigation: breadcrumb link goes home', async ({ page }) => {
    await page.goto('http://localhost:3000/projects/?id=preuabs');
    await page.click('text=Micracode');
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('settings persists provider selection', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    // Open settings
    await page.click('button[title="Settings"]');
    // Change provider
    await page.selectOption('select', 'openai');
    // Should show OpenAI API key field
    await expect(page.locator('input[placeholder="sk-..."]')).toBeVisible();
    // Change output directory
    const outputInput = page.locator('input[placeholder="./output"]');
    await outputInput.fill('./my-output');
    await page.click('button:has-text("Close")');
    // Reload
    await page.reload();
    // Open settings again
    await page.click('button[title="Settings"]');
    // Should retain OpenAI and output dir
    await expect(page.locator('input[placeholder="sk-..."]')).toBeVisible();
    await expect(page.locator('input[placeholder="./output"]')).toHaveValue('./my-output');
  });

});
