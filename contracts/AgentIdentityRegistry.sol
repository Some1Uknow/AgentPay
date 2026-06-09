// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentIdentityRegistry {
    struct Agent {
        string agentURI;
        address owner;
        address agentWallet;
        bool active;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) private agents;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event AgentWalletUpdated(uint256 indexed agentId, address wallet);
    event AgentActiveUpdated(uint256 indexed agentId, bool active);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier onlyOwner(uint256 agentId) {
        require(ownerOf[agentId] == msg.sender, "not owner");
        _;
    }

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        agents[agentId] = Agent({agentURI: agentURI, owner: msg.sender, agentWallet: msg.sender, active: true});
        ownerOf[agentId] = msg.sender;
        balanceOf[msg.sender] += 1;
        emit Transfer(address(0), msg.sender, agentId);
        emit Registered(agentId, agentURI, msg.sender);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external onlyOwner(agentId) {
        agents[agentId].agentURI = newURI;
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function getAgentURI(uint256 agentId) external view returns (string memory) {
        require(ownerOf[agentId] != address(0), "missing");
        return agents[agentId].agentURI;
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        require(ownerOf[agentId] != address(0), "missing");
        return agents[agentId].agentWallet;
    }

    function setAgentWallet(uint256 agentId, address newWallet) external onlyOwner(agentId) {
        require(newWallet != address(0), "zero wallet");
        agents[agentId].agentWallet = newWallet;
        emit AgentWalletUpdated(agentId, newWallet);
    }

    function setActive(uint256 agentId, bool active) external onlyOwner(agentId) {
        agents[agentId].active = active;
        emit AgentActiveUpdated(agentId, active);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        require(ownerOf[agentId] != address(0), "missing");
        return agents[agentId];
    }
}
