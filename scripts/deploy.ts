import { ethers } from "hardhat";

async function main() {
  const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy("5000000000000000000", 2629743);

  await crowdfunding.deployed();

  console.log("Crowdfunding contract deployed to:", crowdfunding.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
