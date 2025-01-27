import { promises as fs } from "fs";
import {
  getUserInfo,
  getAgent,
  joinSpace,
  checkMatching,
} from "./config/api.js";
import logger from "./config/logger.js";

const CONFIG = {
  ENTRY_FEE: [
    0.001, 0.001, 0.01, 0.001, 0.001, 0.001, 0.0001, 0.0001, 0.0001, 0.0001,
    0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001,
  ],
  DELAY: 15000,
  TIMEOUT: 600000, // 10 minutes
  COOLDOWN: 300000, // 5 minutes
};

async function readJsonFile(filepath) {
  try {
    const data = await fs.readFile(filepath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    logger.error("Error reading JSON file:", error);
    return [];
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processAgent(account, agent) {
  if (agent.automationEnabled === false) {
    const generateRandomFee =
      CONFIG.ENTRY_FEE[Math.floor(Math.random() * CONFIG.ENTRY_FEE.length)];

    const battle = await joinSpace(
      account.userId,
      agent.id,
      generateRandomFee,
      account.authToken
    );

    if (battle === null) {
      logger.error(`Error joining space: ${battle?.error || "Unknown error"}`);
      logger.custom(`--------------------------------`);
      await delay(CONFIG.DELAY);
      return;
    }

    logger.info(`${agent.id} Joining Space with ${generateRandomFee}ETH`);
    logger.success(`${agent.name} Joined Space with ${generateRandomFee}ETH`);

    let checkBattle = await checkMatching(battle.matchmakingId);
    const startTime = Date.now();

    while (checkBattle.matchmakingStatus === "QUEUED") {
      if (Date.now() - startTime > CONFIG.TIMEOUT) {
        logger.error("Match did not start within 10 minutes. Moving to next account.");
        return;
      }

      logger.info(`Waiting for match to start...`);
      await delay(CONFIG.DELAY);

      checkBattle = await checkMatching(battle.matchmakingId);
    }

    if (checkBattle.matchmakingStatus === "COMPLETED" || checkBattle.status === "ON_PROGRESS") {
      logger.success(`Match started!`);
    }

    while (checkBattle.session.status !== "COMPLETED") {
      if (Date.now() - startTime > CONFIG.TIMEOUT) {
        logger.error("Match did not complete within 10 minutes. Moving to next account.");
        return;
      }

      logger.info(`Battle in progress...`);
      await delay(CONFIG.DELAY);

      checkBattle = await checkMatching(battle.matchmakingId);
    }

    logger.success(`Rewards distributed and match completed!`);
    delay(CONFIG.DELAY);

    const participant = checkBattle.participants.find(
      (p) => p.agent === agent.id
    );

    if (participant) {
      logger.success("--------------------------------");
      logger.success(`Agent: ${participant.agentData.name}`);
      logger.success(`Rank: ${participant.rank}`);
      logger.success(`Score: ${participant.score}`);
      logger.success(`Reward: ${participant.reward} ETH`);
      logger.success("--------------------------------");
    }

    logger.custom("delay 60 seconds");
    logger.custom(`--------------------------------`);
    await delay(60000);
  }
}

async function processAccount(account) {
  try {
    const userInfo = await getUserInfo(account.userId);

    if (!userInfo) {
      logger.error(`No valid data returned for ${account.userId}`);
      return;
    }

    logger.info(`Total Fractals: ${userInfo.userFractals}`);
    logger.info(`Daily Fractals: ${userInfo.dailyFractals}`);
    logger.info(`Current Rank: ${userInfo.fractalRank.currentRank}`);
    logger.custom(`--------------------------------`);

    const listAgeth = await getAgent(account.userId, account.authToken);

    if (listAgeth && Array.isArray(listAgeth)) {
      for (const agent of listAgeth) {
        await processAgent(account, agent);
      }
    } else {
      logger.error(`No data returned for ${account.userId}`);
    }
  } catch (error) {
    logger.error(`Error fetching user info for ${account.userId}:`, error);
  }
}

async function main() {
  while (true) {
    const accounts = await readJsonFile("account.json");

    if (!accounts.length) {
      logger.error("No accounts found or failed to read the file.");
      return;
    }

    for (const account of accounts) {
      await processAccount(account);
    }

    logger.info(`Cooldown for ${CONFIG.COOLDOWN / 60000} minutes before restarting...`);
    await delay(CONFIG.COOLDOWN);
  }
}

main();
