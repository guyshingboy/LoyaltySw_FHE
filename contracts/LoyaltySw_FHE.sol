pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract LoyaltySw_FHE is ZamaEthereumConfig {
    
    struct LoyaltyData {
        string brand;                    
        euint32 encryptedPoints;        
        uint256 publicRate;              
        uint256 publicMultiplier;        
        string description;              
        address creator;                 
        uint256 timestamp;               
        uint32 decryptedPoints; 
        bool isVerified; 
    }
    

    mapping(string => LoyaltyData) public loyaltyData;
    
    string[] public loyaltyIds;
    
    event LoyaltyDataCreated(string indexed loyaltyId, address indexed creator);
    event DecryptionVerified(string indexed loyaltyId, uint32 decryptedPoints);
    
    constructor() ZamaEthereumConfig() {
    }
    
    function createLoyaltyData(
        string calldata loyaltyId,
        string calldata brand,
        externalEuint32 encryptedPoints,
        bytes calldata inputProof,
        uint256 publicRate,
        uint256 publicMultiplier,
        string calldata description
    ) external {
        require(bytes(loyaltyData[loyaltyId].brand).length == 0, "Loyalty data already exists");
        
        require(FHE.isInitialized(FHE.fromExternal(encryptedPoints, inputProof)), "Invalid encrypted input");
        
        loyaltyData[loyaltyId] = LoyaltyData({
            brand: brand,
            encryptedPoints: FHE.fromExternal(encryptedPoints, inputProof),
            publicRate: publicRate,
            publicMultiplier: publicMultiplier,
            description: description,
            creator: msg.sender,
            timestamp: block.timestamp,
            decryptedPoints: 0,
            isVerified: false
        });
        
        FHE.allowThis(loyaltyData[loyaltyId].encryptedPoints);
        
        FHE.makePubliclyDecryptable(loyaltyData[loyaltyId].encryptedPoints);
        
        loyaltyIds.push(loyaltyId);
        
        emit LoyaltyDataCreated(loyaltyId, msg.sender);
    }
    
    function verifyDecryption(
        string calldata loyaltyId, 
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(bytes(loyaltyData[loyaltyId].brand).length > 0, "Loyalty data does not exist");
        require(!loyaltyData[loyaltyId].isVerified, "Data already verified");
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(loyaltyData[loyaltyId].encryptedPoints);
        
        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
        
        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));
        
        loyaltyData[loyaltyId].decryptedPoints = decodedValue;
        loyaltyData[loyaltyId].isVerified = true;
        
        emit DecryptionVerified(loyaltyId, decodedValue);
    }
    
    function getEncryptedPoints(string calldata loyaltyId) external view returns (euint32) {
        require(bytes(loyaltyData[loyaltyId].brand).length > 0, "Loyalty data does not exist");
        return loyaltyData[loyaltyId].encryptedPoints;
    }
    
    function getLoyaltyData(string calldata loyaltyId) external view returns (
        string memory brand,
        uint256 publicRate,
        uint256 publicMultiplier,
        string memory description,
        address creator,
        uint256 timestamp,
        bool isVerified,
        uint32 decryptedPoints
    ) {
        require(bytes(loyaltyData[loyaltyId].brand).length > 0, "Loyalty data does not exist");
        LoyaltyData storage data = loyaltyData[loyaltyId];
        
        return (
            data.brand,
            data.publicRate,
            data.publicMultiplier,
            data.description,
            data.creator,
            data.timestamp,
            data.isVerified,
            data.decryptedPoints
        );
    }
    
    function getAllLoyaltyIds() external view returns (string[] memory) {
        return loyaltyIds;
    }
    
    function isAvailable() public pure returns (bool) {
        return true;
    }
}


