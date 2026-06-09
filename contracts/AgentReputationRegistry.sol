// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentReputationRegistry {
    struct Reputation {
        uint256 successfulCalls;
        uint256 failedCalls;
        int256 totalRating;
        uint256 ratingCount;
    }

    mapping(uint256 => Reputation) private reputations;
    mapping(bytes32 => bool) public usedPaymentRefs;
    mapping(bytes32 => bool) public usedFeedbackHashes;

    event FeedbackGiven(uint256 indexed agentId, address indexed reviewer, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash);
    event SuccessfulCallRecorded(uint256 indexed agentId, bytes32 indexed paymentRef);
    event FailedCallRecorded(uint256 indexed agentId, bytes32 indexed paymentRef);

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
        require(!usedFeedbackHashes[feedbackHash], "duplicate feedback");
        usedFeedbackHashes[feedbackHash] = true;
        Reputation storage rep = reputations[agentId];
        rep.totalRating += value;
        rep.ratingCount += 1;
        emit FeedbackGiven(agentId, msg.sender, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash);
    }

    function recordSuccessfulCall(uint256 agentId, bytes32 paymentRef) external {
        require(!usedPaymentRefs[paymentRef], "duplicate payment");
        usedPaymentRefs[paymentRef] = true;
        reputations[agentId].successfulCalls += 1;
        emit SuccessfulCallRecorded(agentId, paymentRef);
    }

    function recordFailedCall(uint256 agentId, bytes32 paymentRef) external {
        require(!usedPaymentRefs[paymentRef], "duplicate payment");
        usedPaymentRefs[paymentRef] = true;
        reputations[agentId].failedCalls += 1;
        emit FailedCallRecorded(agentId, paymentRef);
    }

    function getReputation(uint256 agentId) external view returns (uint256 successfulCalls, uint256 failedCalls, int256 totalRating, uint256 ratingCount) {
        Reputation memory rep = reputations[agentId];
        return (rep.successfulCalls, rep.failedCalls, rep.totalRating, rep.ratingCount);
    }
}
