const { test, expect } = require('playwright/test');
const pageUrl = 'http://127.0.0.1:8765/';
const webhook = 'https://discord.com/api/webhooks/123456789/test_token';
async function setup(page) {
  await page.goto(pageUrl);
  await page.locator('#playerSettings summary').click();
  await page.locator('#discordWebhook').fill(webhook);
  await page.locator('#webhookSave').click();
}

test('nickname editing, saved settings, result format, duplicate guard and replay', async ({ page }) => {
  const requests = [];
  await page.route('https://discord.com/api/webhooks/**', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await setup(page);
  await expect(page.locator('#playerName')).toHaveValue(/^(성실한 다람쥐|부지런한 두더지|게으른 나무늘보|귀여운 고양이) \d{4}$/);
  await page.locator('.worldCard[data-world="2"]').click();
  await page.locator('#playerName').fill('실습 플레이어');
  await page.locator('#playerName').press('Space');
  await page.locator('#playerName').press('Enter');
  expect(await page.evaluate(() => state)).toBe('menu');
  await page.locator('#startBtn').click();
  await page.evaluate(() => { score = 1250; wave = 4; endGame(); endGame(); });
  await expect(page.locator('#discordStatus')).toHaveText('디스코드에 결과를 전송했습니다.');
  expect(requests).toHaveLength(1);
  expect(requests[0].content).toMatch(/^실습 플레이어 \| \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \(KST\) \| 솔로 생존 \/ 2세계 할로윈 나이트 \/ 웨이브 4 \| 1250$/);
  expect(requests[0].allowed_mentions).toEqual({ parse: [] });
  expect(await page.evaluate(() => formatPlayDate(new Date('2026-10-17T16:01:02Z')))).toBe('2026-10-18 01:01:02 (KST)');
  await page.locator('#restartBtn').click();
  await page.evaluate(() => { score = 30; endGame(); });
  await expect.poll(() => requests.length).toBe(2);
  await page.reload();
  await expect(page.locator('#playerName')).toHaveValue('실습 플레이어');
  await expect(page.locator('#discordWebhook')).toHaveValue(webhook);
});

test('PvP bonus and HTTP failure do not interrupt the result screen', async ({ page }) => {
  let payload;
  await page.route('https://discord.com/api/webhooks/**', async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 429, body: '{}' });
  });
  await setup(page);
  await page.evaluate(() => { enterWorld(3, 'pvp'); startGame(); score = 80; endPvp(true); });
  await expect(page.locator('#discordStatus')).toContainText('전송 제한');
  expect(payload.content).toContain('PvP · AI / 3세계 얼음왕국 / 대전 스테이지 | 380');
  await expect(page.locator('#centerMsg')).toBeVisible();
});

test('invalid URL, disabled webhook, and network errors are handled', async ({ page }) => {
  await setup(page);
  await page.locator('#discordWebhook').fill('https://example.com/webhook');
  await page.locator('#webhookSave').click();
  await expect(page.locator('#webhookSettingsStatus')).toContainText('URL을 확인');
  await page.locator('#discordWebhook').fill('');
  await page.locator('#webhookSave').click();
  await page.evaluate(() => { enterWorld(1, 'party'); startGame(); endGame(); });
  await expect(page.locator('#discordStatus')).toContainText('전송 꺼짐');
  await page.route('https://discord.com/api/webhooks/**', route => route.abort());
  await page.evaluate(url => { discordWebhookUrl = url; startGame(); endGame(); }, webhook);
  await expect(page.locator('#discordStatus')).toContainText('전송을 확인하지 못했습니다');
});

test('wifi guest reports its nickname and final host score once', async ({ page }) => {
  const payloads = [];
  await page.route('https://discord.com/api/webhooks/**', async route => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, body: '{}' });
  });
  await setup(page);
  await page.locator('#playerName').fill('참가자');
  await page.evaluate(() => {
    wifi.role = 'guest'; wifi.open = true;
    guestStart({ kind:'party', world:1, cls:'ranged', cw:1280, ch:720 });
    wifiHandle({ t:'over', title:'게임 오버', msg:'종료', score:654, wave:7 });
    wifiHandle({ t:'over', title:'게임 오버', msg:'종료', score:654, wave:7 });
  });
  await expect(page.locator('#discordStatus')).toHaveText('디스코드에 결과를 전송했습니다.');
  expect(payloads).toHaveLength(1);
  expect(payloads[0].content).toMatch(/^참가자 \| .*파티 생존 · 와이파이 \/ 1세계 좀비 도시 \/ 웨이브 7 \| 654$/);
});

test('default webhook sends without setup and clearing it stays disabled after reload', async ({ page }) => {
  let count = 0;
  await page.route('https://discord.com/api/webhooks/**', async route => {
    count++;
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto(pageUrl);
  await page.evaluate(() => { enterWorld(1, 'survival'); startGame(); endGame(); });
  await expect(page.locator('#discordStatus')).toHaveText('디스코드에 결과를 전송했습니다.');
  expect(count).toBe(1);
  await page.locator('#menuBtn').click();
  await page.locator('#playerSettings summary').click();
  await page.locator('#discordWebhook').fill('');
  await page.locator('#webhookSave').click();
  await page.reload();
  await page.evaluate(() => { enterWorld(1, 'survival'); startGame(); endGame(); });
  await expect(page.locator('#discordStatus')).toContainText('전송 꺼짐');
  expect(count).toBe(1);
});
