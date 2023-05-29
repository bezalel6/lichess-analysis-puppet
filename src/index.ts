import puppeteer, { Browser } from "puppeteer";
const THINKING_HTML = `<i class="ddloader"></i>`;
const COMPUTING_HTML = `computing`;
const analyze = async (fen: string) => {
  let browser: Browser;
  try {
    browser = await puppeteer.launch({ headless: "new" });

    const page = await browser.newPage();
    await page.goto(`https://lichess.org/analysis/standard/${fen}`);
    await page.type("body", "L");

    let keepWaiting = true;
    const started = new Date().getTime();
    const min = 4,
      max = 10;
    const timeSleep = 100;
    let evaluation: string;
    while (keepWaiting) {
      evaluation = await page.$eval("pearl", (p) => p.innerHTML);
      const diff = (new Date().getTime() - started) / 1000;
      if (evaluation !== THINKING_HTML) {
        const stillThinking = await page.$(COMPUTING_HTML);

        if (diff > min) {
          keepWaiting = stillThinking && diff < max;
        } else keepWaiting = !!stillThinking;
      } else if (diff > max) {
        return "ERROR";
      }
      await timeout(timeSleep);
    }
    return evaluation;
  } finally {
    browser?.close();
  }
};

async function timeout(ms: number) {
  return new Promise<void>((r) => {
    setTimeout(r, ms);
  });
}
const m1 = "rnbqkbnr/ppppp2p/8/4Ppp1/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3";

analyze(m1).then(console.log);
