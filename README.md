# Confidential Loyalty Swap

Confidential Loyalty Swap is a privacy-preserving loyalty point exchange platform powered by Zama's Fully Homomorphic Encryption (FHE) technology. This innovative DeFi solution allows users to seamlessly swap loyalty points between different brands without exposing sensitive data. By leveraging FHE, the platform ensures that personal and transactional data remain confidential, safeguarding user privacy while enabling secure transactions.

## The Problem

In today’s digital economy, loyalty programs are becoming increasingly popular. However, most programs require users to share their loyalty points in cleartext, exposing them to potential privacy breaches and misuse. This transparency can be detrimental, as competitors may gain access to sensitive business information through user data. Furthermore, brand loyalty points can often be underutilized or lost, leading to financial waste and limited market opportunities.

## The Zama FHE Solution

Fully Homomorphic Encryption (FHE) provides a groundbreaking solution to the data privacy concerns inherent in loyalty point exchanges. With Zama’s FHE technology, we can perform computations on encrypted data without ever needing to decrypt it. This means that sensitive information related to loyalty points can be exchanged and processed while remaining completely confidential.

Using **fhevm** to process encrypted inputs, Confidential Loyalty Swap allows users to engage in transactions with a high level of security and trust. Brands can provide services without the risk of exposing their proprietary information or viewing competitors’ data. This enhances user trust and fosters a competitive but respectful business environment.

## Key Features

- 🔒 **Privacy-Preserving Transactions**: Loyalty points can be swapped without revealing cleartext data.
- 💸 **Seamless Exchanges**: Effortlessly exchange points between multiple brands while ensuring confidentiality.
- 🔄 **Dynamic Point Valuation**: Utilize homeomorphic computations to determine real-time point values and conversion rates.
- 🎁 **Gift and Reward Options**: Users can gift points to friends or redeem rewards without fear of data exposure.
- 💼 **Business Insights**: Brands can access aggregate data insights without compromising individual user information.

## Technical Architecture & Stack

The architecture of Confidential Loyalty Swap is designed to maximize privacy while ensuring robust functionality. The core technology stack is as follows:

- **Zama FHE Technologies**:
  - **fhevm**: For processing encrypted loyalty transactions.
  - **Concrete ML**: For advanced data analysis and point valuation.
- **Frontend**: React.js
- **Backend**: Node.js with Express
- **Database**: MongoDB
- **Smart Contracts**: Solidity for on-chain transactions

## Smart Contract / Core Logic

Below is a simplified illustration of how the Confidential Loyalty Swap smart contracts are structured utilizing Zama's technology:solidity
// Solidity smart contract for loyalty point exchange

pragma solidity ^0.8.0;

import "TFHE.sol";

contract LoyaltySwap {
    mapping(address => uint64) public loyaltyPoints;

    function swapPoints(address fromBrand, address toBrand, uint64 points) public {
        // Encrypt the loyalty points before processing
        uint64 encryptedPoints = TFHE.encrypt(points);
        
        // Execute the transaction using encrypted data
        loyaltyPoints[fromBrand] -= encryptedPoints;
        loyaltyPoints[toBrand] += encryptedPoints;
        
        // Decrypt the updated loyalty points
        uint64 decryptedPoints = TFHE.decrypt(loyaltyPoints[toBrand]);
    }
}

## Directory Structure

The project follows a structured folder organization for clarity and maintainability. Below is the tree structure:
ConfidentialLoyaltySwap/
├── .sol
│   └── LoyaltySwap.sol
├── src/
│   ├── index.js
│   ├── components/
│   │   ├── LoyaltyPointExchange.js
│   │   └── UserProfile.js
│   └── services/
│       └── LoyaltyService.js
├── backend/
│   ├── server.js
│   └── controllers/
│       └── LoyaltyController.js
├── package.json
└── README.md

## Installation & Setup

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js (v14 or later)
- npm (Node Package Manager)

### Installation Steps

1. **Clone the repository**
   (Note: Please follow your preferred method to obtain the project files.)

2. **Install the project dependencies**:
   Navigate to the project directory and run:bash
   npm install
   
3. **Install the Zama library**:
   Make sure to install the necessary Zama library for FHE:bash
   npm install fhevm

## Build & Run

Once you have set up the project, you can compile and run the application with the following commands:

1. **Build the Smart Contracts**:bash
   npx hardhat compile

2. **Start the Backend Server**:bash
   node backend/server.js

3. **Start the Frontend Application**:bash
   npm start

## Acknowledgements

We would like to extend our sincere gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their commitment to advancing privacy technologies has made it feasible to build secure, innovative solutions like Confidential Loyalty Swap, ensuring user data is protected throughout the exchange process.


