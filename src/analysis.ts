// analysis.ts
import puppeteer, { Browser, Page } from "puppeteer";
import { Response, Line } from ".";
const THINKING_HTML = `<i class="ddloader"></i>`;
const COMPUTING_HTML = `computing`;

export const CACHE_MAX = 5000;

async function analyze(
  fen: string,
  min: number,
  max: number,
  waitForFirstResult: boolean
): Promise<Response> {
  let browser: Browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
    });

    const page = await browser.newPage();
    await page.goto(`https://lichess.org/analysis/standard/${fen}`);
    await page.type("body", "L");
    await analysisSetup(page);
    let keepWaiting = true;
    const started = new Date().getTime();
    const timeSleep = 1;
    let evaluation: Response = { eval: "no-eval", fen, lines: [] };
    while (keepWaiting) {
      let str = await page.$eval("pearl", (p) => p.innerHTML);
      const diff = (new Date().getTime() - started) / 1000;
      if (str !== THINKING_HTML) {
        const stillThinking = await page.$(COMPUTING_HTML);

        if (diff > min) {
          keepWaiting = stillThinking && diff < max;
        } else keepWaiting = !!stillThinking;
      } else if (!waitForFirstResult && diff > max) {
        throw new Error("Analysis timeout");
      }
      evaluation.eval = str;
      await timeout(timeSleep);
    }
    evaluation.lines = await getLines(page);
    return evaluation;
  } finally {
    browser?.close();
  }
}

const selectors = {
  analysisMenuBtn:
    "#main-wrap > main > div.analyse__controls.analyse-controls > button",
  analysis: {
    memoryInput: "#analyse-memory",
    threadsInput: "#analyse-threads",
    linesInput: "#analyse-multipv",
  },
};

async function analysisSetup(page: Page) {
  await clickBtn(page, selectors.analysisMenuBtn);
  await setInputVal(page, selectors.analysis.linesInput, "5");
  await setInputVal(page, selectors.analysis.threadsInput, "5");
  await setInputVal(page, selectors.analysis.memoryInput, "10");
  await clickBtn(page, selectors.analysisMenuBtn);
}

/**
 * DONT FORGET TO WAIT BEFORE THE LINES SHOW UP
 * @param page
 */
async function getLines(page: Page) {
  const lines = await page.$eval(".pv_box", (parent) => {
    const uciArr: Line[] = [];
    const elements = parent.querySelectorAll(".pv");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const obj = {
        move: element.getAttribute("data-uci"),
        eval: element.querySelector("strong").innerText,
      };
      uciArr.push(obj);
    }
    return uciArr;
  });
  return lines;
}

async function clickBtn(page: Page, selector: string) {
  return page.$eval(selector, (btn) => {
    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    btn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

const setInputVal = async (page: Page, selector: string, value: string) => {
  return page
    .$eval(
      selector,
      (_input, value) => {
        // throw "hello";
        const input = _input as HTMLInputElement;
        input.value = value;
        const event = new Event("input", {
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(event);
      },
      value
    )
    .catch((e) => {
      console.error(`threw ${e} trying to set ${value} to ${selector}`);
    });
};

async function timeout(ms: number): Promise<void> {
  return new Promise<void>((r) => {
    setTimeout(r, ms);
  });
}

export { analyze, getLines };
