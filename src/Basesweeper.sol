// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Basesweeper
 * @dev Onchain Minesweeper-style game using blockhash for randomness
 *      16x16 Grid (256 tiles). One winning tile per game.
 *      Players pay 0.0008 ETH to click a tile.
 *      Uses future blockhash for provably fair randomness.
 *      Winner takes the entire pool.
 */
contract Basesweeper {
    // Game Configuration
    uint256 public gameId;
    uint256 public constant FEE = 0.0008 ether;
    uint256 public constant BLOCK_DELAY = 3; // Wait 3 blocks (~36 seconds on Base)
    uint256 public constant REVEAL_REWARD = 0.00001 ether; // Small incentive for anyone to reveal

    uint256 private nextRequestId;

    struct Game {
        uint256 pool;
        address winner;
        bool active;
        uint256 clickedMask; // Bitmap of 256 tiles (1 = clicked/revealed)
    }

    struct PendingClick {
        address player;
        uint256 tileIndex;
        uint256 gameId;
        uint256 targetBlock;
        bool fulfilled;
    }

    mapping(uint256 => Game) public games;
    mapping(uint256 => PendingClick) public pendingClicks;

    // Events
    event GameStarted(uint256 indexed gameId);
    event ClickPending(
        uint256 indexed gameId,
        uint256 indexed requestId,
        address indexed player,
        uint256 tileIndex,
        uint256 targetBlock
    );
    event GameWon(uint256 indexed gameId, address indexed winner, uint256 payout);
    event TileClicked(uint256 indexed gameId, uint256 tileIndex, address indexed player);

    constructor() {
        gameId = 1;
        games[gameId].active = true;
        nextRequestId = 1;
        emit GameStarted(gameId);
    }

    /**
     * @dev Click a tile on the grid. Creates a pending click that will be revealed after BLOCK_DELAY blocks.
     * @param tileIndex Index of the tile (0-255).
     */
    function click(uint256 tileIndex) external payable {
        require(msg.value >= FEE, "Insufficient fee");
        require(tileIndex < 256, "Invalid tile index");

        Game storage currentGame = games[gameId];
        require(currentGame.active, "Game not active");

        // Check if tile was already clicked
        require((currentGame.clickedMask >> tileIndex) & 1 == 0, "Tile already clicked");

        // Add fee to pool immediately
        currentGame.pool += msg.value;

        // Create pending click for future block
        uint256 requestId = nextRequestId++;
        uint256 targetBlock = block.number + BLOCK_DELAY;

        pendingClicks[requestId] = PendingClick({
            player: msg.sender,
            tileIndex: tileIndex,
            gameId: gameId,
            targetBlock: targetBlock,
            fulfilled: false
        });

        emit ClickPending(gameId, requestId, msg.sender, tileIndex, targetBlock);
    }

    /**
     * @dev Reveal the outcome of a pending click using blockhash.
     *      Anyone can call this function after the target block is reached.
     *      Caller receives a small reward to incentivize timely reveals.
     * @param requestId The ID of the pending click to reveal
     */
    function revealOutcome(uint256 requestId) external {
        PendingClick storage pending = pendingClicks[requestId];

        require(!pending.fulfilled, "Already fulfilled");
        require(block.number >= pending.targetBlock, "Too early to reveal");
        require(block.number <= pending.targetBlock + 256, "Blockhash expired");

        // Get blockhash for randomness
        uint256 randomSeed = uint256(blockhash(pending.targetBlock));
        require(randomSeed != 0, "Blockhash not available");

        pending.fulfilled = true;

        // Determine winning tile from blockhash
        uint256 winningTile = randomSeed % 256;

        Game storage currentGame = games[pending.gameId];

        if (pending.tileIndex == winningTile) {
            // WINNER - Player found the winning tile!
            currentGame.winner = pending.player;
            currentGame.active = false;

            uint256 payout = currentGame.pool;
            uint256 rewardAmount = REVEAL_REWARD;

            // Ensure we have enough for reward
            if (payout > rewardAmount) {
                payout -= rewardAmount;
            } else {
                rewardAmount = 0;
            }

            emit GameWon(pending.gameId, pending.player, payout);

            // Transfer pool to winner
            (bool sentToWinner, ) = pending.player.call{value: payout}("");
            require(sentToWinner, "Failed to send to winner");

            // Reward the revealer
            if (rewardAmount > 0) {
                (bool sentToRevealer, ) = msg.sender.call{value: rewardAmount}("");
                require(sentToRevealer, "Failed to send reward");
            }

            // Start new game
            gameId++;
            games[gameId].active = true;
            emit GameStarted(gameId);
        } else {
            // LOSER - Reveal the clicked tile as empty
            currentGame.clickedMask |= (uint256(1) << pending.tileIndex);

            emit TileClicked(pending.gameId, pending.tileIndex, pending.player);

            // Reward the revealer
            (bool sentToRevealer, ) = msg.sender.call{value: REVEAL_REWARD}("");
            require(sentToRevealer, "Failed to send reward");
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

    /**
     * @dev Get details of a pending click request
     * @param requestId The request ID
     */
    function getPendingClick(uint256 requestId) external view returns (
        address player,
        uint256 tileIndex,
        uint256 pendingGameId,
        uint256 targetBlock,
        bool fulfilled
    ) {
        PendingClick storage pc = pendingClicks[requestId];
        return (pc.player, pc.tileIndex, pc.gameId, pc.targetBlock, pc.fulfilled);
    }

    /**
     * @dev Check if a pending click is ready to be revealed
     * @param requestId The request ID
     */
    function canReveal(uint256 requestId) external view returns (bool) {
        PendingClick storage pc = pendingClicks[requestId];
        return !pc.fulfilled &&
               block.number >= pc.targetBlock &&
               block.number <= pc.targetBlock + 256;
    }
}
