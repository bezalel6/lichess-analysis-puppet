// index.ts
import express from "express";
import { CACHE_MAX, analyze, getLines } from "./analysis";
import { Browser, Page } from "puppeteer";

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

export interface Response {
  fen: string;
  eval: string;
  lines: Line[];
}
export type Line = { move: string; eval: string };

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
