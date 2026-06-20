// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

contract AgentIdentityRegistry {
    struct Agent {
        string agentURI;
        address owner;
        address agentWallet;
        bool active;
    }

    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    string public name = "AgentPay ERC-8004 Agents";
    string public symbol = "APAGENT";

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) private agents;
    mapping(uint256 => mapping(string => bytes)) private metadata;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(address => uint256) public nonces;

    bytes4 private constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
    bytes32 private constant SET_WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 nonce,uint256 deadline,uint256 chainId,address verifyingContract)");

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);

    modifier onlyExisting(uint256 agentId) {
        require(ownerOf[agentId] != address(0), "missing");
        _;
    }

    modifier onlyOwnerOrApproved(uint256 agentId) {
        address owner = ownerOf[agentId];
        require(owner != address(0), "missing");
        require(msg.sender == owner || getApproved[agentId] == msg.sender || isApprovedForAll[owner][msg.sender], "not owner/operator");
        _;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f;
    }

    function register() external returns (uint256 agentId) {
        agentId = _register(msg.sender, "");
    }

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _register(msg.sender, agentURI);
    }

    function register(string calldata agentURI, MetadataEntry[] calldata entries) external returns (uint256 agentId) {
        agentId = _register(msg.sender, agentURI);
        for (uint256 i = 0; i < entries.length; i++) {
            _setMetadata(agentId, entries[i].metadataKey, entries[i].metadataValue);
        }
    }

    function _register(address owner, string memory agentURI) internal returns (uint256 agentId) {
        agentId = nextAgentId++;
        ownerOf[agentId] = owner;
        balanceOf[owner] += 1;
        agents[agentId] = Agent({agentURI: agentURI, owner: owner, agentWallet: owner, active: true});
        emit Transfer(address(0), owner, agentId);
        emit Registered(agentId, agentURI, owner);
        _setMetadata(agentId, "agentWallet", abi.encode(owner));
    }

    function tokenURI(uint256 agentId) public view onlyExisting(agentId) returns (string memory) {
        return agents[agentId].agentURI;
    }

    function getAgentURI(uint256 agentId) external view returns (string memory) {
        return tokenURI(agentId);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external onlyOwnerOrApproved(agentId) {
        agents[agentId].agentURI = newURI;
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function getAgentWallet(uint256 agentId) external view onlyExisting(agentId) returns (address) {
        return agents[agentId].agentWallet;
    }

    function unsetAgentWallet(uint256 agentId) external onlyOwnerOrApproved(agentId) {
        agents[agentId].agentWallet = address(0);
        _setMetadata(agentId, "agentWallet", abi.encode(address(0)));
    }

    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external onlyOwnerOrApproved(agentId) {
        require(newWallet != address(0), "zero wallet");
        require(block.timestamp <= deadline, "expired");
        bytes32 digest = keccak256(abi.encode(SET_WALLET_TYPEHASH, agentId, newWallet, nonces[newWallet]++, deadline, block.chainid, address(this)));
        require(_isValidWalletSignature(newWallet, digest, signature), "bad wallet signature");
        agents[agentId].agentWallet = newWallet;
        _setMetadata(agentId, "agentWallet", abi.encode(newWallet));
    }

    function getMetadata(uint256 agentId, string memory metadataKey) external view onlyExisting(agentId) returns (bytes memory) {
        return metadata[agentId][metadataKey];
    }

    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external onlyOwnerOrApproved(agentId) {
        require(keccak256(bytes(metadataKey)) != keccak256(bytes("agentWallet")), "reserved key");
        _setMetadata(agentId, metadataKey, metadataValue);
    }

    function setActive(uint256 agentId, bool active) external onlyOwnerOrApproved(agentId) {
        agents[agentId].active = active;
        _setMetadata(agentId, "active", abi.encode(active));
    }

    function getAgent(uint256 agentId) external view onlyExisting(agentId) returns (Agent memory) {
        return agents[agentId];
    }

    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf[tokenId];
        require(owner != address(0), "missing");
        require(msg.sender == owner || isApprovedForAll[owner][msg.sender], "not owner/operator");
        getApproved[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public onlyOwnerOrApproved(tokenId) {
        require(ownerOf[tokenId] == from, "wrong owner");
        require(to != address(0), "zero recipient");
        delete getApproved[tokenId];
        ownerOf[tokenId] = to;
        agents[tokenId].owner = to;
        agents[tokenId].agentWallet = address(0);
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        _setMetadata(tokenId, "agentWallet", abi.encode(address(0)));
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        transferFrom(from, to, tokenId);
    }

    function _setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) internal {
        metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    function _isValidWalletSignature(address signer, bytes32 digest, bytes calldata signature) internal view returns (bool) {
        if (signer.code.length > 0) {
            return IERC1271(signer).isValidSignature(digest, signature) == ERC1271_MAGIC_VALUE;
        }
        if (signature.length != 65) return false;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s) == signer;
    }
}
