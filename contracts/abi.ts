export const BASESWEEPER_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "_seed", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [{ "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" }],
        "name": "GameStarted",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "winner", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "payout", "type": "uint256" }
        ],
        "name": "GameWon",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "gameId", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "tileIndex", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "player", "type": "address" }
        ],
        "name": "TileClicked",
        "type": "event"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "tileIndex", "type": "uint256" }],
        "name": "click",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "FEE",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "gameId",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "_gameId", "type": "uint256" }],
        "name": "getGameState",
        "outputs": [
            { "internalType": "uint256", "name": "pool", "type": "uint256" },
            { "internalType": "address", "name": "winner", "type": "address" },
            { "internalType": "bool", "name": "active", "type": "bool" },
            { "internalType": "uint256", "name": "clickedMask", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

// Placeholder address - Replace with actual deployed address
export const BASESWEEPER_ADDRESS = "0xF435A735E3A455c1af51eb7Ccc411EB9a5693430"; 
