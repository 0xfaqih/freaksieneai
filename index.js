import { promises as fs } from "fs";
import {
  getUserInfo,
  getAgent,
  joinSpace,
  checkMatching,
} from "./config/hapi.js";
import logger from "./config/logger.js";

async function readJsonFile(filepath) {
  try {
    const data = await fs.readFile(filepath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    logger.error("Error reading JSON file:", error);
    return [];
  }
}

const CONFIG = {
  ENTRY_FEE: [
    0.001, 0.001, 0.01, 0.001, 0.001, 0.001, 0.0001, 0.0001, 0.0001, 0.0001,
    0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001,
  ],
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processAccounts(accounts) {
  for (const account of accounts) {
    const userInfo = await getUserInfo(account.userId);
    if (userInfo) {
      console.log(userInfo.userFractals);
    }
  }
}

async function main() {
  const accounts = await readJsonFile("account.json");
  if (!accounts.length) {
    logger.error("No accounts found or failed to read the file.");
    return;
  }
  await processAccounts(accounts);
}

main();
