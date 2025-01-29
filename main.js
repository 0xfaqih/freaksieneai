import {
  getUserInfo,
  getAgent,
  joinSpace,
  checkMatching,
  refreshAuthToken,
} from "./config/api.js";
import { ethers } from "ethers";
import logger from "./config/logger.js";

const CONFIG = {
  ENTRY_FEE: [
    0.001, 0.001, 0.001, 0.001, 0.001, 0.01, 0.001, 0.01, 0.001, 0.01, 0.001,
    0.1, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001,
  ],
  DELAY: 15000,
  TIMEOUT: 600000, // 10 minutes
  COOLDOWN: 300000, // 5 minutes
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function handleBattle(account, agent, battle, entryFees) {
  logger.info(`${agent.id} Joining Space with ${entryFees}ETH`);
  logger.success(`${agent.name} Joined Space with ${entryFees}ETH`);

  let checkBattle = await checkMatching(battle.matchmakingId);
  const startTime = Date.now();

  while (checkBattle.matchmakingStatus === "QUEUED") {
    if (Date.now() - startTime > CONFIG.TIMEOUT) {
      logger.error(
        "Match did not start within 10 minutes. Moving to next account."
      );
      return;
    }

    logger.info(`Waiting for match to start...`);
    await delay(CONFIG.DELAY);

    checkBattle = await checkMatching(battle.matchmakingId);
  }

  if (
    checkBattle.matchmakingStatus === "COMPLETED" ||
    checkBattle.status === "ON_PROGRESS"
  ) {
    logger.success(`Match started!`);
  }

  while (checkBattle.session.status !== "COMPLETED") {
    if (Date.now() - startTime > CONFIG.TIMEOUT) {
      logger.error(
        "Match did not complete within 10 minutes. Moving to next account."
      );
      return;
    }

    logger.info(`Battle in progress...`);
    await delay(CONFIG.DELAY);

    checkBattle = await checkMatching(battle.matchmakingId);
  }

  logger.success(`Rewards distributed and match completed!`);
  await delay(CONFIG.DELAY);

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

async function processAgent(account, agent) {
  if (!agent.automationEnabled) {
    const entryFees =
      CONFIG.ENTRY_FEE[Math.floor(Math.random() * CONFIG.ENTRY_FEE.length)];
    const battle = await joinSpace(
      account.userId,
      agent.id,
      entryFees,
      account.authToken
    );

    if (battle === null) {
      logger.error(`Error joining space: ${battle?.error || "Unknown error"}`);
      logger.custom(`--------------------------------`);
      await delay(CONFIG.DELAY);
      return;
    }

    await handleBattle(account, agent, battle, entryFees);
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

    const agents = await getAgent(account.userId, account.authToken);

    if (agents && Array.isArray(agents)) {
      for (const agent of agents) {
        await processAgent(account, agent);
      }
    } else {
      logger.error(`No data returned for ${account.userId}`);
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logger.error(`Auth token expired for ${account.userId}, refreshing...`);
      const authData = await refreshAuthToken(
        account.walletAddress,
        account.privateKey
      );
      if (authData) {
        account.authToken = authData.accessToken;
        account.userId = authData.user.id;
        logger.info(`Access token regenerated for ${account.authToken}`);
        await processAccount(account);
      } else {
        logger.error(`Failed to refresh auth token for ${account.userId}`);
      }
    } else {
      logger.error(`Error fetching user info for ${account.userId}:`, error);
    }
  }
}

async function main() {
  const privateKeysEnv = process.env.PRIVATE_KEYS;

  if (!privateKeysEnv) {
    logger.error("No private keys found in environment variables.");
    return;
  }

  const privateKeys = privateKeysEnv.split(",");

  if (!privateKeys.length) {
    logger.error("No private keys found in environment variables.");
    return;
  }

  const accounts = [];
  for (const privateKey of privateKeys) {
    const wallet = new ethers.Wallet(privateKey);
    const authData = await refreshAuthToken(wallet.address, privateKey);
    if (authData) {
      accounts.push({
        userId: authData.user.id,
        authToken: authData.accessToken,
        walletAddress: wallet.address,
        privateKey,
      });
      logger.info(`Authenticated wallet: ${wallet.address}`);
    } else {
      logger.error(`Failed to authenticate wallet: ${wallet.address}`);
    }
  }

  while (true) {
    for (const account of accounts) {
      await processAccount(account);
    }

    logger.info(
      `Cooldown for ${CONFIG.COOLDOWN / 60000} minutes before restarting...`
    );
    await delay(CONFIG.COOLDOWN);
  }
}

main();
