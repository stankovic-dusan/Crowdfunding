//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Crowdfunding is Ownable {
  mapping(address => uint256) public contributors;
  address admin;
  uint256 noOfContributors;
  uint256 minimumContribution;
  uint256 deadline;
  uint256 goal;
  uint256 raisedAmount;

  struct Request {
    string description;
    address payable recipient;
    uint256 value;
    bool completed;
    uint256 noOfVoters;
    mapping(address => bool) voters;
  }

  mapping(uint256 => Request) public requests;
  uint256 public numRequsets;

  event ContributeEvent(address _sender, uint256 _value);
  event CreateRequestEvent(string _description, address _recipient, uint256 _value);
  event MakePaymentEvent(address _recipient, uint256 _value);

  constructor(uint256 _goal, uint256 _deadline) {
    goal = _goal;
    deadline = block.timestamp + _deadline;
    minimumContribution = 0.1 ether;
    admin = msg.sender;
  }

  function createRequest(
    string memory _description,
    address payable _recipient,
    uint256 _value
  ) public onlyOwner {
    Request storage newRequest = requests[numRequsets];
    numRequsets++;
    newRequest.description = _description;
    newRequest.recipient = _recipient;
    newRequest.value = _value;
    newRequest.completed = false;
    newRequest.noOfVoters = 0;

    emit CreateRequestEvent(_description, _recipient, _value);
  }

  function voteRequest(uint256 _requestNumber) public {
    require(contributors[msg.sender] > 0, "You are not contributor!");
    Request storage thisRequest = requests[_requestNumber];

    require(thisRequest.voters[msg.sender] == false, "You are alredy voted!");
    thisRequest.voters[msg.sender] = true;
    thisRequest.noOfVoters++;
  }

  function contribute() public payable {
    require(block.timestamp < deadline, "Deadline has passed!");
    require(msg.value >= minimumContribution, "Minimum contribution not met!");

    if (contributors[msg.sender] == 0) noOfContributors++;

    contributors[msg.sender] += msg.value;
    raisedAmount += msg.value;

    emit ContributeEvent(msg.sender, msg.value);
  }

  function getRefund() public {
    require(block.timestamp > deadline, "Deadline has not passed.");
    require(raisedAmount < goal, "The goal was met");
    require(contributors[msg.sender] > 0, "You are not contributor!");

    address payable recipient = payable(msg.sender);
    uint256 value = contributors[msg.sender];
    recipient.transfer(value);

    // payable(msg.sender).transfer(contributors[msg.sender]);

    contributors[msg.sender] = 0;
  }

  function makePayment(uint256 _requestNumber) public onlyOwner {
    Request storage thisRequest = requests[_requestNumber];
    require(thisRequest.completed == false, "The requrest has been completed!");
    require(thisRequest.noOfVoters > noOfContributors / 2, "The request needs more than 50% of the contributors.");

    thisRequest.completed = true;
    thisRequest.recipient.transfer(thisRequest.value);

    emit MakePaymentEvent(thisRequest.recipient, thisRequest.value);
  }

  receive() external payable {
    contribute();
  }

  function getBalance() public view returns (uint256) {
    return address(this).balance;
  }

  function getAdmin() public view returns (address) {
    return admin;
  }

  function getNoOfContributors() public view returns (uint256) {
    return noOfContributors;
  }

  function getMinimumContribution() public view returns (uint256) {
    return minimumContribution;
  }

  function getDeadline() public view returns (uint256) {
    return deadline;
  }

  function getGoal() public view returns (uint256) {
    return goal;
  }

  function getRaisedAmount() public view returns (uint256) {
    return raisedAmount;
  }
}
