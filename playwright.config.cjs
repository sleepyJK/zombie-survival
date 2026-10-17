module.exports = {
  testDir: './tests',
  testMatch: 'discord-results.cjs',
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  },
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765/',
    reuseExistingServer: false
  }
};
