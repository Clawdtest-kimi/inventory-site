import Redis from "ioredis";

// Redis Labs connection
// URL format: redis://default:password@host:port
const redisUrl = process.env.REDIS_URL || "redis://default:kNrkXeL3W5bB3tQwb1Wv8d9dTLlyQngv@redis-13938.c73.us-east-1-2.ec2.cloud.redislabs.com:13938";

// Initialize Redis client
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
});

// Key for storing inventory data
export const INVENTORY_KEY = "inventory:data";
export const INVENTORY_LOG_KEY = "inventory:log";

export async function saveInventory(data: any[], source: string) {
  const timestamp = new Date().toISOString();
  
  // Save current inventory
  await redis.set(INVENTORY_KEY, JSON.stringify({
    data,
    updatedAt: timestamp,
    source
  }));
  
  // Add to log
  const logEntry = {
    id: Date.now().toString(),
    timestamp,
    source,
    rows: data.length
  };
  
  // Get existing log and add new entry (keep last 50)
  const existingLogRaw = await redis.get(INVENTORY_LOG_KEY);
  const existingLog = existingLogRaw ? JSON.parse(existingLogRaw) : [];
  const newLog = [logEntry, ...existingLog].slice(0, 50);
  await redis.set(INVENTORY_LOG_KEY, JSON.stringify(newLog));
  
  return { success: true, timestamp };
}

export async function getInventory() {
  const data = await redis.get(INVENTORY_KEY);
  return data ? JSON.parse(data) : null;
}

export async function getInventoryLog() {
  const data = await redis.get(INVENTORY_LOG_KEY);
  return data ? JSON.parse(data) : [];
}
