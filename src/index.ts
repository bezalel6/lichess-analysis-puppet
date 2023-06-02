import puppeteer, { Browser, Page } from "puppeteer";
import express from "express";

const THINKING_HTML = `<i class="ddloader"></i>`;
const COMPUTING_HTML = `computing`;

const CACHE_MAX = 5000;

const app = express();
const port = 3000;

// In-memory cache
let cache: { [fen: string]: Response } = {};

app.get("/analyze/:fen", async (req, res) => {
  const fen = req.params.fen;
  const min = req.query.min ? parseInt(req.query.min as string) : 4;
  const max = req.query.max ? parseInt(req.query.max as string) : 10;
  const waitForFirstResult = req.query.waitForFirstResult
    ? Boolean(req.query.waitForFirstResult)
    : true;

  try {
    let evaluation: Response;

    if (cache[fen]) {
      // Use cached result if available
      evaluation = cache[fen];
    } else {
      evaluation = await analyze(fen, min, max, waitForFirstResult);
      // Cache the result for future use
      if (Object.keys(cache).length >= CACHE_MAX) {
        cache = {};
      }
      cache[fen] = evaluation;
    }

    res.send(evaluation);
  } catch (error) {
    console.error("An error occurred during analysis:", error);
    res.status(500).send("An error occurred during analysis");
  }
});

interface Response {
  fen: string;
  eval: string;
  lines: Line[];
}
type Line = { move: string; eval: string };

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
async function test() {
  const fen = "r1b1k1nr/pppp1ppp/2n5/8/1bPq4/1QN5/PP3PPP/R1B1KBNR w KQkq - 0 7";
  console.log("testing");
  let browser: Browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    });

    const page = await browser.newPage();
    await page.goto(`https://lichess.org/analysis/standard/${fen}`);
    await page.type("body", "L");
    await analysisSetup(page);
    await timeout(5000);

    // await page.screenshot({ path: "debug-pic.png", type: "png" });

    // await setInputVal(page, "#analyse-memory", "5");
    await page.screenshot({ path: "pic.png", type: "png" });
    console.log("done testing");
  } catch (e) {
    throw `threw: ${e}`;
  } finally {
    browser?.close();
  }
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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
