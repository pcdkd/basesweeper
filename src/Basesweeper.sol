// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Basesweeper
 * @dev Onchain Minesweeper-style game for Base Mini App.
 *      16x16 Grid (256 tiles).
 *      One winning tile per game.
 *      Players pay a fee to click a tile.
 *      If they find the winning tile, they win the pool.
 *      If not, the fee is added to the pool and the tile is revealed as empty.
 */
contract Basesweeper {
    // State Variables
    uint256 private seed;
    uint256 public gameId;
    uint256 public constant FEE = 0.0008 ether;

    struct Game {
        uint256 pool;
        address winner;
        bool active;
        uint256 clickedMask; // Bitmap of 256 tiles (1 = clicked/revealed)
    }

    mapping(uint256 => Game) public games;

    // Events
    event GameStarted(uint256 indexed gameId);
    event GameWon(uint256 indexed gameId, address indexed winner, uint256 payout);
    event TileClicked(uint256 indexed gameId, uint256 tileIndex, address indexed player);

    constructor(uint256 _seed) {
        seed = _seed;
        gameId = 1;
        games[gameId].active = true;
        emit GameStarted(gameId);
    }

    /**
     * @dev Click a tile on the grid.
     * @param tileIndex Index of the tile (0-255).
     */
    function click(uint256 tileIndex) external payable {
        require(msg.value >= FEE, "Insufficient fee");
        require(tileIndex < 256, "Invalid tile index");
        
        Game storage currentGame = games[gameId];
        require(currentGame.active, "Game not active");
        
        // Check if tile was already clicked
        require((currentGame.clickedMask >> tileIndex) & 1 == 0, "Tile already clicked");

        // Determine winning tile
        // NOTE: In a production environment with high stakes, this randomization 
        // should be replaced with Chainlink VRF or a Commit-Reveal scheme 
        // to prevent miners/validators from predicting the outcome.
        uint256 winningTile = uint256(keccak256(abi.encodePacked(seed, gameId))) % 256;

        if (tileIndex == winningTile) {
            // WINNER
            currentGame.winner = msg.sender;
            currentGame.active = false;
            currentGame.pool += msg.value;
            
            uint256 payout = currentGame.pool;
            
            // Reset pool for struct (optional, but good for clarity)
            // currentGame.pool = 0; 
            
            emit GameWon(gameId, msg.sender, payout);
            
            // Transfer payout
            (bool sent, ) = msg.sender.call{value: payout}("");
            require(sent, "Failed to send Ether");

            // Start new game
            gameId++;
            games[gameId].active = true;
            emit GameStarted(gameId);
        } else {
            // LOSER
            currentGame.pool += msg.value;
            currentGame.clickedMask |= (uint256(1) << tileIndex);
            
            emit TileClicked(gameId, tileIndex, msg.sender);
        }
    }

    /**
     * @dev Get the state of a game.
     * @param _gameId Game ID.
     */
    function getGameState(uint256 _gameId) external view returns (
        uint256 pool,
        address winner,
        bool active,
        uint256 clickedMask
    ) {
        Game storage g = games[_gameId];
        return (g.pool, g.winner, g.active, g.clickedMask);
    }

    /**
     * @dev Helper to check if a specific tile is clicked in a game.
     */
    function isTileClicked(uint256 _gameId, uint256 tileIndex) external view returns (bool) {
        return (games[_gameId].clickedMask >> tileIndex) & 1 == 1;
    }
}
