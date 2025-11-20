#!/bin/bash

# Basesweeper Deployment Script for Base Sepolia
# This script will deploy the contract and update the frontend

set -e

echo "=================================="
echo "Basesweeper Deployment Script"
echo "=================================="
echo ""

# Load environment variables
source env_foundry

echo "Step 1: Deploying contract to Base Sepolia..."
echo "You will be prompted for your keystore password."
echo ""

# Deploy contract
forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --account deployer \
  --broadcast \
  --verify

echo ""
echo "=================================="
echo "Deployment complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Copy the deployed contract address from above"
echo "2. Run: node update-frontend.js <CONTRACT_ADDRESS>"
echo "3. The frontend will be automatically updated with the new address and ABI"
echo ""
