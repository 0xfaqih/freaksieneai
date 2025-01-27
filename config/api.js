import axios from "axios";
import axiosRetry from "axios-retry";
import logger from "./logger.js";

const BASE_URL = "https://dapp-backend-large.fractionai.xyz";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://dapp.fractionai.xyz",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/237.84.2.178 Safari/537.36",
    Host: "dapp-backend-large.fractionai.xyz",
    Origin: "https://dapp.fractionai.xyz",
    Referer: "https://dapp.fractionai.xyz/",
  },
});

axiosRetry(axiosInstance, {
  retries: 20,
  retryDelay: (retryCount) => {
    const delay = retryCount * 5000;
    logger.warn(`Retry #${retryCount} after delay of ${delay}ms`);
    return delay;
  },
  shouldResetTimeout: true,
  retryCondition: (error) => {
    if (error.code === "ECONNABORTED") {
      logger.error("Retrying due to timeout...");
      return true;
    }

    if (error.response) {
      const errorMessage = error.response?.data?.error;
      if (
        errorMessage &&
        errorMessage === "timeout exceeded when trying to connect"
      ) {
        logger.error(`Timeout error occurred: ${errorMessage}, retrying...`);
        return true;
      }
    }

    return false;
  },
});

async function getUserInfo(userId) {
  try {
    const response = await axiosInstance.get(
      `/api3/rewards/fractal/user/${userId}`
    );
    return response.data;
  } catch (error) {
    logger.error("Error fetching user info:", error);
    return null;
  }
}

async function getAgent(userId, authToken) {
  try {
    const response = await axiosInstance.get(`/api3/agents/user/${userId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    return response.data;
  } catch (error) {
    logger.error("Error fetching agent info:", error);
    return null;
  }
}

async function joinSpace(userId, agentId, entryFees, authToken) {
  try {
    const response = await axiosInstance.post(
      `/api3/matchmaking/initiate`,
      {
        userId: userId,
        entryFees: entryFees,
        agentId: agentId,
        sessionTypeId: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    logger.error("Error joining space:", error);
    return null;
  }
}

async function checkMatching(matchmakingId) {
  try {
    const response = await axiosInstance.get(
      `/api3/matchmaking/detail/${matchmakingId}`
    );
    return response.data;
  } catch (error) {
    logger.error("Error checking matching:", error);
    return null;
  }
}

export { getUserInfo, getAgent, joinSpace, checkMatching };
