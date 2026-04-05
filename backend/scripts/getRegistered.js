import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// อ่าน contractData.json
const contractDataPath = path.join(__dirname, "../contractData.json");
const contractData = JSON.parse(fs.readFileSync(contractDataPath, "utf8"));

const CONTRACT_ADDRESS = contractData.address;
const ABI = contractData.abi;
const DEPLOY_BLOCK = contractData.deployBlock;

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_URL);

// แปลง Role enum เป็น string
function roleToString(role) {
  switch (Number(role)) {
    case 0: return "None";
    case 1: return "Orchard";
    case 2: return "PackingHouse";
    case 3: return "Transporter";
    case 4: return "Retailer";
    default: return "Unknown";
  }
}

async function main() {
  console.log("🚀 Connecting to contract...");

  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  const latestBlock = await provider.getBlockNumber();
  console.log(`🔍 Fetching RoleRegistered events from block ${DEPLOY_BLOCK} to ${latestBlock}`);

  const BATCH_SIZE = 10; // Free Tier limit
  let allEvents = [];

  for (let fromBlock = DEPLOY_BLOCK; fromBlock <= latestBlock; fromBlock += BATCH_SIZE) {
    const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, latestBlock);
    console.log(`📦 Fetching blocks ${fromBlock} → ${toBlock}`);

    try {
      const events = await contract.queryFilter("RoleRegistered", fromBlock, toBlock);
      allEvents.push(...events);
      process.stdout.write(`.${events.length}`); // แสดง progress
    } catch (err) {
      console.error(`❌ Error fetching blocks ${fromBlock}-${toBlock}:`, err.message);
    }
  }

  console.log(`\n🎉 Found ${allEvents.length} RoleRegistered events`);

  const roles = allEvents.map(event => ({
    user: event.args.user,
    roleId: Number(event.args.role),
    role: roleToString(event.args.role),
    timestamp: Number(event.args.timestamp),
    date: new Date(Number(event.args.timestamp) * 1000).toLocaleString("th-TH"),
    blockNumber: event.blockNumber
  }));

  console.log("💾 Saving roles.json...");

  if (!fs.existsSync("data")) fs.mkdirSync("data");
  fs.writeFileSync("data/roles.json", JSON.stringify(roles, null, 2));

  console.log("✅ Done!");
}

main().catch(console.error);