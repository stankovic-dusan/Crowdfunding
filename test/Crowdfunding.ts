import { expect } from "chai";
import { ethers } from "hardhat";
import { Crowdfunding } from "../typechain-types/contracts/Crowdfunding";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Crowdfunding", function () {
  let crowdfunding: Crowdfunding;
  let signers: any;
  let crowdfundingAdmin: any;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    crowdfundingAdmin = signers[0];

    const crowdfundingFactory = await ethers.getContractFactory("Crowdfunding", crowdfundingAdmin);

    crowdfunding = (await crowdfundingFactory.deploy(ethers.utils.parseEther("100"), 604800)) as Crowdfunding;
    await crowdfunding.deployed();

    expect(crowdfunding.address).to.properAddress;
    expect(await crowdfunding.getAdmin()).to.be.eq(crowdfundingAdmin.address);
  });
  describe("Contribute to the crowdfunding", async () => {
    it("should users contribute to the crowdfunding", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.connect(signers[4]).contribute({ value: ethers.utils.parseEther("2") });
      await crowdfunding.connect(signers[5]).contribute({ value: ethers.utils.parseEther("10") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(5);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("23"));
    });
    it("should users contribute to the crowdfunding (receive function)", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await signers[1].sendTransaction({ to: crowdfunding.address, value: ethers.utils.parseEther("3") });
      await signers[2].sendTransaction({ to: crowdfunding.address, value: ethers.utils.parseEther("6") });
      await signers[3].sendTransaction({ to: crowdfunding.address, value: ethers.utils.parseEther("4") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(3);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("13"));
    });
    it("should fail to contribute to the crowdfunding if the deadline has passed", async () => {
      let deadline = await crowdfunding.getDeadline();
      await time.increaseTo(deadline.add(1));
      await expect(crowdfunding.contribute({ value: ethers.utils.parseEther("1") })).to.revertedWith("Deadline has passed!");
    });
    it("should fail to contribute to the crowdfunding with insufficient funds", async () => {
      await expect(crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("0.01") })).to.be.revertedWith("Minimum contribution not met!");
    });
  });
  describe("Create first spending request", async () => {
    it("should crowdfunding admin create spending request", async () => {
      expect(await crowdfunding.numRequsets()).to.be.eq(0);
      await crowdfunding.createRequest("food for pets", signers[2].address, ethers.utils.parseEther("5"));
      // console.log(await crowdfunding.requests(0));
      expect(await crowdfunding.numRequsets()).to.be.eq(1);
    });
    it("should fail to create spending request if user is not admin", async () => {
      expect(await crowdfunding.numRequsets()).to.be.eq(0);
      crowdfunding = crowdfunding.connect(signers[2]);
      await expect(crowdfunding.createRequest("food for pets", signers[2].address, ethers.utils.parseEther("5"))).to.revertedWith("Ownable: caller is not the owner");
    });
  });
  describe("Voting for specific spending request", async () => {
    it("should contributors voting for spending request", async () => {
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      expect(await crowdfunding.numRequsets()).to.be.eq(0);
      await crowdfunding.createRequest("food for animals", signers[2].address, ethers.utils.parseEther("4"));
      expect(await crowdfunding.numRequsets()).to.be.eq(1);
      expect(await (await crowdfunding.requests(0)).noOfVoters).to.be.eq(0);
      await crowdfunding.connect(signers[1]).voteRequest(0);
      await crowdfunding.connect(signers[2]).voteRequest(0);
      await crowdfunding.connect(signers[3]).voteRequest(0);
      expect(await (await crowdfunding.requests(0)).noOfVoters).to.be.eq(3);
    });
    it("should fail voting if a user is not a contributor", async () => {
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      expect(await crowdfunding.numRequsets()).to.be.eq(0);
      await crowdfunding.createRequest("food for pets", signers[2].address, ethers.utils.parseEther("2"));
      expect(await crowdfunding.numRequsets()).to.be.eq(1);
      await expect(crowdfunding.connect(signers[3]).voteRequest(0)).to.revertedWith("You are not contributor!");
    });
    it("should fail voting if a user already voted", async () => {
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      expect(await crowdfunding.numRequsets()).to.be.eq(0);
      await crowdfunding.createRequest("food for animals", signers[2].address, ethers.utils.parseEther("4"));
      expect(await crowdfunding.numRequsets()).to.be.eq(1);
      expect(await (await crowdfunding.requests(0)).noOfVoters).to.be.eq(0);
      await crowdfunding.connect(signers[1]).voteRequest(0);
      await crowdfunding.connect(signers[2]).voteRequest(0);
      await expect(crowdfunding.connect(signers[1]).voteRequest(0)).to.be.revertedWith("You are alredy voted!");
    });
  });
  describe("Make a payment for specific request", async () => {
    it("should make a payment if there are more than 50% votes for the request", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.connect(signers[4]).contribute({ value: ethers.utils.parseEther("2") });
      await crowdfunding.connect(signers[5]).contribute({ value: ethers.utils.parseEther("10") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(5);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("23"));
      expect(await crowdfunding.numRequsets()).to.be.eq(0);
      await crowdfunding.createRequest("food for animals", signers[2].address, ethers.utils.parseEther("10"));
      await crowdfunding.connect(signers[1]).voteRequest(0);
      await crowdfunding.connect(signers[2]).voteRequest(0);
      await crowdfunding.connect(signers[3]).voteRequest(0);
      expect(await (await crowdfunding.requests(0)).noOfVoters).to.be.eq(3);
      await crowdfunding.makePayment(0);
      expect(await (await crowdfunding.requests(0)).completed).to.be.eq(true);
    });
    it("should fail if there are less than 50% votes for the request", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.connect(signers[4]).contribute({ value: ethers.utils.parseEther("2") });
      await crowdfunding.connect(signers[5]).contribute({ value: ethers.utils.parseEther("10") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(5);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("23"));
      expect(await crowdfunding.numRequsets()).to.be.eq(0);
      await crowdfunding.createRequest("food for animals", signers[2].address, ethers.utils.parseEther("10"));
      await expect(crowdfunding.makePayment(0)).to.be.revertedWith("The request needs more than 50% of the contributors.");
    });
    it("should fail to make a payment if user is not admin", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.connect(signers[4]).contribute({ value: ethers.utils.parseEther("2") });
      await crowdfunding.connect(signers[5]).contribute({ value: ethers.utils.parseEther("10") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(5);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("23"));
      expect(await crowdfunding.numRequsets()).to.be.eq(0);
      await crowdfunding.createRequest("food for animals", signers[2].address, ethers.utils.parseEther("10"));
      await expect(crowdfunding.connect(signers[9]).makePayment(0)).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  describe("Contributors request a refund", async () => {
    it("should contributor can get a refund if deadline has passed", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.connect(signers[4]).contribute({ value: ethers.utils.parseEther("2") });
      await crowdfunding.connect(signers[5]).contribute({ value: ethers.utils.parseEther("10") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(5);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("23"));
      let deadline = await crowdfunding.getDeadline();
      await time.increaseTo(deadline.add(1));
      await expect(crowdfunding.connect(signers[3]).getRefund()).to.changeEtherBalance(signers[3], ethers.utils.parseEther("7"));
    });
    it("should contributor can get a refund if goal was not reached", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.connect(signers[4]).contribute({ value: ethers.utils.parseEther("2") });
      await crowdfunding.connect(signers[5]).contribute({ value: ethers.utils.parseEther("50") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(5);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("63"));
      let deadline = await crowdfunding.getDeadline();
      await time.increaseTo(deadline.add(10));
      await expect(crowdfunding.connect(signers[3]).getRefund()).to.changeEtherBalance(signers[3], ethers.utils.parseEther("7"));
    });
    it("should fail to get a refund if a user is not a contributor to the crowdfunding", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.connect(signers[4]).contribute({ value: ethers.utils.parseEther("2") });
      await crowdfunding.connect(signers[5]).contribute({ value: ethers.utils.parseEther("50") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(5);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("63"));
      let deadline = await crowdfunding.getDeadline();
      await time.increaseTo(deadline.add(10));
      await expect(crowdfunding.connect(signers[9]).getRefund()).to.be.revertedWith("You are not contributor!");
    });
    it("should fail to get a refund if the deadline has passed", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.connect(signers[4]).contribute({ value: ethers.utils.parseEther("2") });
      await crowdfunding.connect(signers[5]).contribute({ value: ethers.utils.parseEther("50") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(5);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("63"));
      await expect(crowdfunding.connect(signers[3]).getRefund()).to.be.revertedWith("Deadline has not passed.");
    });
    it("should fail to get a refund if the goal was met", async () => {
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(0);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(0);
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.connect(signers[4]).contribute({ value: ethers.utils.parseEther("2") });
      await crowdfunding.connect(signers[5]).contribute({ value: ethers.utils.parseEther("100") });
      expect(await crowdfunding.getNoOfContributors()).to.be.eq(5);
      expect(await crowdfunding.getRaisedAmount()).to.be.eq(ethers.utils.parseEther("113"));
      let deadline = await crowdfunding.getDeadline();
      await time.increaseTo(deadline.add(10));
      await expect(crowdfunding.connect(signers[3]).getRefund()).to.be.revertedWith("The goal was met");
    });
  });
  describe("Crowdfunding contract events", async () => {
    it("should contribute function emit ContributeEvent", async () => {
      await expect(crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") }))
        .to.emit(crowdfunding, "ContributeEvent")
        .withArgs(signers[1].address, ethers.utils.parseEther("1"));
    });
    it("should createRequest function emit CreateRequestEvent", async () => {
      await crowdfunding.createRequest("food for pets", signers[2].address, ethers.utils.parseEther("5"));
      await expect(crowdfunding.createRequest("food for pets", signers[2].address, ethers.utils.parseEther("5")))
        .to.emit(crowdfunding, "CreateRequestEvent")
        .withArgs("food for pets", signers[2].address, ethers.utils.parseEther("5"));
    });
    it("should makePayment function emit MakePaymentEvent", async () => {
      await crowdfunding.connect(signers[1]).contribute({ value: ethers.utils.parseEther("1") });
      await crowdfunding.connect(signers[2]).contribute({ value: ethers.utils.parseEther("3") });
      await crowdfunding.connect(signers[3]).contribute({ value: ethers.utils.parseEther("7") });
      await crowdfunding.createRequest("food for animals", signers[2].address, ethers.utils.parseEther("10"));
      await crowdfunding.connect(signers[1]).voteRequest(0);
      await crowdfunding.connect(signers[2]).voteRequest(0);
      await expect(crowdfunding.makePayment(0)).to.emit(crowdfunding, "MakePaymentEvent").withArgs(signers[2].address, ethers.utils.parseEther("10"));
      expect(await (await crowdfunding.requests(0)).completed).to.be.eq(true);
    });
  });
});
