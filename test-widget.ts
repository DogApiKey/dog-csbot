import { chromium } from "playwright";

async function testWidget() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Opening widget page...");
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

  // Take a screenshot
  await page.screenshot({ path: "/tmp/csbot-widget-1.png" });
  console.log("Screenshot 1: Initial page");

  // Click the chat button (inside shadow DOM)
  console.log("Clicking chat button...");
  await page.evaluate(() => {
    const widget = document.querySelector("csbot-widget");
    if (widget?.shadowRoot) {
      const btn = widget.shadowRoot.querySelector(".toggle-btn") as HTMLButtonElement;
      btn?.click();
    }
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: "/tmp/csbot-widget-2.png" });
  console.log("Screenshot 2: Chat opened");

  // Type a message
  console.log("Typing message...");
  await page.evaluate(() => {
    const widget = document.querySelector("csbot-widget");
    if (widget?.shadowRoot) {
      const input = widget.shadowRoot.querySelector("input") as HTMLInputElement;
      if (input) {
        input.value = "你们的退货政策是什么？";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });

  await page.screenshot({ path: "/tmp/csbot-widget-3.png" });
  console.log("Screenshot 3: Message typed");

  // Click send
  console.log("Clicking send...");
  await page.evaluate(() => {
    const widget = document.querySelector("csbot-widget");
    if (widget?.shadowRoot) {
      const buttons = widget.shadowRoot.querySelectorAll("button");
      for (const btn of buttons) {
        if (btn.textContent?.trim() === "Send") {
          btn.click();
          break;
        }
      }
    }
  });

  // Wait for response
  console.log("Waiting for response...");
  await page.waitForTimeout(15000);

  await page.screenshot({ path: "/tmp/csbot-widget-4.png" });
  console.log("Screenshot 4: After response");

  // Get the messages
  const messages = await page.evaluate(() => {
    const widget = document.querySelector("csbot-widget");
    if (widget?.shadowRoot) {
      const msgs = widget.shadowRoot.querySelectorAll(".message");
      return Array.from(msgs).map((m) => m.textContent?.trim() || "");
    }
    return [];
  });
  console.log("Messages:", messages);

  await browser.close();
  console.log("Done!");
}

testWidget().catch(console.error);
