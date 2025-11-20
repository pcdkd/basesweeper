#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get contract address from command line argument
const contractAddress = process.argv[2];

if (!contractAddress) {
  console.error('Error: Please provide the deployed contract address');
  console.error('Usage: node update-frontend.js <CONTRACT_ADDRESS>');
  process.exit(1);
}

// Validate address format
if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
  console.error('Error: Invalid Ethereum address format');
  process.exit(1);
}

console.log('================================');
console.log('Updating Frontend');
console.log('================================');
console.log('');

// Read the ABI from the build output
const abiPath = path.join(__dirname, 'out/Basesweeper.sol/Basesweeper.json');
console.log('1. Reading ABI from:', abiPath);

const buildOutput = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
const abi = buildOutput.abi;

console.log(`   ✓ ABI loaded (${abi.length} entries)`);
console.log('');

// Create the new abi.ts content
console.log('2. Generating contracts/abi.ts...');

const abiContent = `export const BASESWEEPER_ABI = ${JSON.stringify(abi, null, 2)} as const;

export const BASESWEEPER_ADDRESS = "${contractAddress}" as const;
`;

// Write the updated file
const outputPath = path.join(__dirname, 'contracts/abi.ts');
fs.writeFileSync(outputPath, abiContent);

console.log('   ✓ contracts/abi.ts updated');
console.log('');

// Verify the new functions are present
const newFunctions = ['revealOutcome', 'canReveal', 'getPendingClick', 'BLOCK_DELAY', 'REVEAL_REWARD'];
const abiNames = abi.map(item => item.name).filter(Boolean);

console.log('3. Verifying new functions in ABI:');
newFunctions.forEach(func => {
  if (abiNames.includes(func)) {
    console.log(`   ✓ ${func}`);
  } else {
    console.log(`   ✗ ${func} - NOT FOUND!`);
  }
});
console.log('');

console.log('================================');
console.log('Frontend Update Complete!');
console.log('================================');
console.log('');
console.log('Contract Address:', contractAddress);
console.log('ABI Functions:', abi.filter(item => item.type === 'function').length);
console.log('ABI Events:', abi.filter(item => item.type === 'event').length);
console.log('');
console.log('Next steps:');
console.log('1. Review the changes in contracts/abi.ts');
console.log('2. Update hooks/useBasesweeper.ts to use new functions');
console.log('3. Test the frontend with npm run dev');
console.log('');
