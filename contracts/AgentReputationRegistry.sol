// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAgentIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
    function getApproved(uint256 agentId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

contract AgentReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    struct Reputation {
        uint256 successfulCalls;
        uint256 failedCalls;
        int256 totalRating;
        uint256 ratingCount;
    }

    address private identityRegistry;
    bool private initialized;
    mapping(uint256 => Reputation) private reputations;
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) private feedbacks;
    mapping(uint256 => mapping(address => uint64)) private lastIndexes;
    mapping(uint256 => address[]) private clients;
    mapping(uint256 => mapping(address => bool)) private seenClient;
    mapping(bytes32 => bool) public usedPaymentRefs;
    mapping(uint256 => mapping(address => mapping(uint64 => string[]))) private responseURIs;
    mapping(uint256 => mapping(address => mapping(uint64 => bytes32[]))) private responseHashes;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );
    event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex);
    event ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex, address responder, string responseURI, bytes32 responseHash);
    event SuccessfulCallRecorded(uint256 indexed agentId, bytes32 indexed paymentRef);
    event FailedCallRecorded(uint256 indexed agentId, bytes32 indexed paymentRef);

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

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        require(valueDecimals <= 18, "bad decimals");
        require(_agentExists(agentId), "missing agent");
        require(!_isAgentOwnerOrOperator(agentId, msg.sender), "agent reviewer");

        uint64 feedbackIndex = lastIndexes[agentId][msg.sender] + 1;
        lastIndexes[agentId][msg.sender] = feedbackIndex;
        feedbacks[agentId][msg.sender][feedbackIndex] = Feedback({
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            tag2: tag2,
            isRevoked: false
        });

        if (!seenClient[agentId][msg.sender]) {
            seenClient[agentId][msg.sender] = true;
            clients[agentId].push(msg.sender);
        }

        Reputation storage rep = reputations[agentId];
        rep.totalRating += value;
        rep.ratingCount += 1;

        emit NewFeedback(agentId, msg.sender, feedbackIndex, value, valueDecimals, tag1, tag1, tag2, endpoint, feedbackURI, feedbackHash);
    }

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage feedback = feedbacks[agentId][msg.sender][feedbackIndex];
        require(feedbackIndex != 0 && feedbackIndex <= lastIndexes[agentId][msg.sender], "missing feedback");
        require(!feedback.isRevoked, "revoked");
        feedback.isRevoked = true;
        Reputation storage rep = reputations[agentId];
        rep.totalRating -= feedback.value;
        rep.ratingCount -= 1;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    function appendResponse(uint256 agentId, address clientAddress, uint64 feedbackIndex, string calldata responseURI, bytes32 responseHash) external {
        require(feedbackIndex != 0 && feedbackIndex <= lastIndexes[agentId][clientAddress], "missing feedback");
        responseURIs[agentId][clientAddress][feedbackIndex].push(responseURI);
        responseHashes[agentId][clientAddress][feedbackIndex].push(responseHash);
        emit ResponseAppended(agentId, clientAddress, feedbackIndex, msg.sender, responseURI, responseHash);
    }

    function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals) {
        require(clientAddresses.length > 0, "clients required");
        int256 total;
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            address client = clientAddresses[i];
            uint64 lastIndex = lastIndexes[agentId][client];
            for (uint64 feedbackIndex = 1; feedbackIndex <= lastIndex; feedbackIndex++) {
                Feedback storage feedback = feedbacks[agentId][client][feedbackIndex];
                if (feedback.isRevoked) continue;
                if (!_stringMatches(tag1, feedback.tag1) || !_stringMatches(tag2, feedback.tag2)) continue;
                total += feedback.value;
                count += 1;
            }
        }
        summaryValue = count == 0 ? int128(0) : int128(total / int256(uint256(count)));
        summaryValueDecimals = 0;
    }

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) external view returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked) {
        Feedback storage feedback = feedbacks[agentId][clientAddress][feedbackIndex];
        return (feedback.value, feedback.valueDecimals, feedback.tag1, feedback.tag2, feedback.isRevoked);
    }

    function readAllFeedback(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2, bool includeRevoked)
        external
        view
        returns (address[] memory outClients, uint64[] memory feedbackIndexes, int128[] memory values, uint8[] memory valueDecimals, string[] memory tag1s, string[] memory tag2s, bool[] memory revokedStatuses)
    {
        uint256 total = _countFeedback(agentId, clientAddresses, tag1, tag2, includeRevoked);
        outClients = new address[](total);
        feedbackIndexes = new uint64[](total);
        values = new int128[](total);
        valueDecimals = new uint8[](total);
        tag1s = new string[](total);
        tag2s = new string[](total);
        revokedStatuses = new bool[](total);

        uint256 cursor;
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            address client = clientAddresses[i];
            uint64 lastIndex = lastIndexes[agentId][client];
            for (uint64 feedbackIndex = 1; feedbackIndex <= lastIndex; feedbackIndex++) {
                Feedback storage feedback = feedbacks[agentId][client][feedbackIndex];
                if ((!includeRevoked && feedback.isRevoked) || !_stringMatches(tag1, feedback.tag1) || !_stringMatches(tag2, feedback.tag2)) continue;
                outClients[cursor] = client;
                feedbackIndexes[cursor] = feedbackIndex;
                values[cursor] = feedback.value;
                valueDecimals[cursor] = feedback.valueDecimals;
                tag1s[cursor] = feedback.tag1;
                tag2s[cursor] = feedback.tag2;
                revokedStatuses[cursor] = feedback.isRevoked;
                cursor++;
            }
        }
    }

    function getResponseCount(uint256 agentId, address clientAddress, uint64 feedbackIndex, address[] calldata) external view returns (uint64 count) {
        return uint64(responseURIs[agentId][clientAddress][feedbackIndex].length);
    }

    function getClients(uint256 agentId) external view returns (address[] memory) {
        return clients[agentId];
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        return lastIndexes[agentId][clientAddress];
    }

    function recordSuccessfulCall(uint256 agentId, bytes32 paymentRef) external {
        require(_agentExists(agentId), "missing agent");
        require(!usedPaymentRefs[paymentRef], "duplicate payment");
        usedPaymentRefs[paymentRef] = true;
        reputations[agentId].successfulCalls += 1;
        emit SuccessfulCallRecorded(agentId, paymentRef);
    }

    function recordFailedCall(uint256 agentId, bytes32 paymentRef) external {
        require(_agentExists(agentId), "missing agent");
        require(!usedPaymentRefs[paymentRef], "duplicate payment");
        usedPaymentRefs[paymentRef] = true;
        reputations[agentId].failedCalls += 1;
        emit FailedCallRecorded(agentId, paymentRef);
    }

    function getReputation(uint256 agentId) external view returns (uint256 successfulCalls, uint256 failedCalls, int256 totalRating, uint256 ratingCount) {
        Reputation memory rep = reputations[agentId];
        return (rep.successfulCalls, rep.failedCalls, rep.totalRating, rep.ratingCount);
    }

    function _agentExists(uint256 agentId) internal view returns (bool) {
        try IAgentIdentityRegistry(identityRegistry).ownerOf(agentId) returns (address owner) {
            return owner != address(0);
        } catch {
            return false;
        }
    }

    function _isAgentOwnerOrOperator(uint256 agentId, address clientAddress) internal view returns (bool) {
        IAgentIdentityRegistry registry = IAgentIdentityRegistry(identityRegistry);
        address owner = registry.ownerOf(agentId);
        return clientAddress == owner || registry.getApproved(agentId) == clientAddress || registry.isApprovedForAll(owner, clientAddress);
    }

    function _stringMatches(string calldata expected, string storage actual) internal view returns (bool) {
        return bytes(expected).length == 0 || keccak256(bytes(expected)) == keccak256(bytes(actual));
    }

    function _countFeedback(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2, bool includeRevoked) internal view returns (uint256 total) {
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            address client = clientAddresses[i];
            uint64 lastIndex = lastIndexes[agentId][client];
            for (uint64 feedbackIndex = 1; feedbackIndex <= lastIndex; feedbackIndex++) {
                Feedback storage feedback = feedbacks[agentId][client][feedbackIndex];
                if ((!includeRevoked && feedback.isRevoked) || !_stringMatches(tag1, feedback.tag1) || !_stringMatches(tag2, feedback.tag2)) continue;
                total++;
            }
        }
    }
}
