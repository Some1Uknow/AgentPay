// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IValidationIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
    function getApproved(uint256 agentId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

contract AgentValidationRegistry {
    struct ValidationStatus {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        uint256 lastUpdate;
        string tag;
        bool exists;
    }

    address private identityRegistry;
    bool private initialized;
    mapping(bytes32 => ValidationStatus) private statuses;
    mapping(uint256 => bytes32[]) private agentValidations;
    mapping(address => bytes32[]) private validatorRequests;

    event ValidationRequest(address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash);
    event ValidationResponse(address indexed validatorAddress, uint256 indexed agentId, bytes32 indexed requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag);

    constructor(address identityRegistry_) {
        _initialize(identityRegistry_);
    }

    function initialize(address identityRegistry_) external {
        require(!initialized, "initialized");
        _initialize(identityRegistry_);
    }

    function _initialize(address identityRegistry_) internal {
        require(identityRegistry_ != address(0), "zero identity");
        identityRegistry = identityRegistry_;
        initialized = true;
    }

    function getIdentityRegistry() external view returns (address) {
        return identityRegistry;
    }

    function validationRequest(address validatorAddress, uint256 agentId, string calldata requestURI, bytes32 requestHash) external {
        require(validatorAddress != address(0), "zero validator");
        require(requestHash != bytes32(0), "zero request");
        require(_isAgentOwnerOrOperator(agentId, msg.sender), "not owner/operator");
        require(!statuses[requestHash].exists, "duplicate request");
        statuses[requestHash] = ValidationStatus({
            validatorAddress: validatorAddress,
            agentId: agentId,
            response: 0,
            responseHash: bytes32(0),
            lastUpdate: block.timestamp,
            tag: "",
            exists: true
        });
        agentValidations[agentId].push(requestHash);
        validatorRequests[validatorAddress].push(requestHash);
        emit ValidationRequest(validatorAddress, agentId, requestURI, requestHash);
    }

    function validationResponse(bytes32 requestHash, uint8 response, string calldata responseURI, bytes32 responseHash, string calldata tag) external {
        require(response <= 100, "bad response");
        ValidationStatus storage status = statuses[requestHash];
        require(status.exists, "missing request");
        require(status.validatorAddress == msg.sender, "not validator");
        status.response = response;
        status.responseHash = responseHash;
        status.lastUpdate = block.timestamp;
        status.tag = tag;
        emit ValidationResponse(msg.sender, status.agentId, requestHash, response, responseURI, responseHash, tag);
    }

    function getValidationStatus(bytes32 requestHash) external view returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 responseHash, string memory tag, uint256 lastUpdate) {
        ValidationStatus storage status = statuses[requestHash];
        return (status.validatorAddress, status.agentId, status.response, status.responseHash, status.tag, status.lastUpdate);
    }

    function getSummary(uint256 agentId, address[] calldata validatorAddresses, string calldata tag) external view returns (uint64 count, uint8 averageResponse) {
        bytes32[] storage hashes = agentValidations[agentId];
        uint256 total;
        for (uint256 i = 0; i < hashes.length; i++) {
            ValidationStatus storage status = statuses[hashes[i]];
            if (validatorAddresses.length > 0 && !_addressIncluded(validatorAddresses, status.validatorAddress)) continue;
            if (bytes(tag).length > 0 && keccak256(bytes(tag)) != keccak256(bytes(status.tag))) continue;
            total += status.response;
            count += 1;
        }
        averageResponse = count == 0 ? 0 : uint8(total / uint256(count));
    }

    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return agentValidations[agentId];
    }

    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory) {
        return validatorRequests[validatorAddress];
    }

    function _isAgentOwnerOrOperator(uint256 agentId, address caller) internal view returns (bool) {
        IValidationIdentityRegistry registry = IValidationIdentityRegistry(identityRegistry);
        address owner = registry.ownerOf(agentId);
        return caller == owner || registry.getApproved(agentId) == caller || registry.isApprovedForAll(owner, caller);
    }

    function _addressIncluded(address[] calldata items, address item) internal pure returns (bool) {
        for (uint256 i = 0; i < items.length; i++) {
            if (items[i] == item) return true;
        }
        return false;
    }
}
