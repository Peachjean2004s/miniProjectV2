const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting deployment to Sepolia...");

  // 1. Deploy Contract
  const LonganTracker = await hre.ethers.getContractFactory("LonganSupplyChain");
  const tracker = await LonganTracker.deploy();

  await tracker.waitForDeployment(); // รอจนกว่าจะ Deploy เสร็จ

  const contractAddress = await tracker.getAddress();
  console.log(`✅ LonganSupplyChain deployed to: ${contractAddress}`);

  // 🟢 เพิ่มตรงนี้: ดึงข้อมูล Transaction Receipt เพื่อหา Block Number ล่าสุดที่เพิ่ง Deploy ไป
  const tx = tracker.deploymentTransaction();
  const receipt = await tx.wait();
  const deployBlock = receipt.blockNumber;
  console.log(`📦 Deployed at Block Number: ${deployBlock}`);

  // 2. ดึง ABI (Interface ของ Contract)
  const artifactPath = path.join(__dirname, "../artifacts/contracts/LonganSmartContract.sol/LonganSupplyChain.json");
  
  if (!fs.existsSync(artifactPath)) {
      throw new Error("❌ Artifact not found. Please run 'npx hardhat compile' first.");
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // 3. เตรียมข้อมูลที่จะบันทึก 
  const contractData = {
    address: contractAddress,
    abi: artifact.abi,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    deployBlock: deployBlock 
  };

  // 4. บันทึกไฟล์ไปยังโฟลเดอร์ Backend
  const outputDir = path.join(__dirname, "../../backend");
  const outputPath = path.join(outputDir, "contractData.json");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(contractData, null, 2));
  console.log(`💾 Contract data saved to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});