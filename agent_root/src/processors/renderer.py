from __future__ import annotations


async def render_page(url: str, timeout_ms: int) -> str:
    """Render a public page without persisting cookies or downloads."""
    from playwright.async_api import async_playwright

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        try:
            context = await browser.new_context(accept_downloads=False)
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            return await page.content()
        finally:
            await browser.close()
