import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useBlockNumber, useWatchContractEvent } from 'wagmi';
import { BASESWEEPER_ABI, BASESWEEPER_ADDRESS } from '../contracts/abi';
import { useState, useEffect } from 'react';

export function useBasesweeper() {
    const { address } = useAccount();
    const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
    const [pendingClicks, setPendingClicks] = useState<Map<bigint, {
        requestId: bigint,
        tileIndex: bigint,
        targetBlock: bigint,
        player: string
    }>>(new Map());

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    });

    // Track current block number
    const { data: blockNumber } = useBlockNumber({ watch: true });

    // Read Game ID
    const { data: gameId } = useReadContract({
        address: BASESWEEPER_ADDRESS,
        abi: BASESWEEPER_ABI,
        functionName: 'gameId',
    });

    // Read Game State
    const { data: gameState, refetch: refetchGameState } = useReadContract({
        address: BASESWEEPER_ADDRESS,
        abi: BASESWEEPER_ABI,
        functionName: 'getGameState',
        args: gameId ? [gameId] : undefined,
        query: {
            enabled: !!gameId,
        }
    });

    // Read Fee
    const { data: fee } = useReadContract({
        address: BASESWEEPER_ADDRESS,
        abi: BASESWEEPER_ABI,
        functionName: 'FEE',
    });

    // Read Block Delay
    const { data: blockDelay } = useReadContract({
        address: BASESWEEPER_ADDRESS,
        abi: BASESWEEPER_ABI,
        functionName: 'BLOCK_DELAY',
    });

    // Watch for ClickPending events
    useWatchContractEvent({
        address: BASESWEEPER_ADDRESS,
        abi: BASESWEEPER_ABI,
        eventName: 'ClickPending',
        onLogs(logs) {
            logs.forEach((log) => {
                const { gameId, requestId, player, tileIndex, targetBlock } = log.args as {
                    gameId: bigint;
                    requestId: bigint;
                    player: string;
                    tileIndex: bigint;
                    targetBlock: bigint;
                };

                // Store pending click
                setPendingClicks(prev => new Map(prev).set(requestId, {
                    requestId,
                    tileIndex,
                    targetBlock,
                    player,
                }));
            });
        },
    });

    // Watch for GameWon events
    useWatchContractEvent({
        address: BASESWEEPER_ADDRESS,
        abi: BASESWEEPER_ABI,
        eventName: 'GameWon',
        onLogs(logs) {
            logs.forEach((log) => {
                const { gameId: wonGameId } = log.args as { gameId: bigint };

                // Remove pending clicks for this game
                setPendingClicks(prev => {
                    const newMap = new Map(prev);
                    newMap.forEach((click, key) => {
                        // Remove all pending clicks (game is won)
                        newMap.delete(key);
                    });
                    return newMap;
                });

                // Refetch game state
                refetchGameState();
            });
        },
    });

    // Watch for TileClicked events
    useWatchContractEvent({
        address: BASESWEEPER_ADDRESS,
        abi: BASESWEEPER_ABI,
        eventName: 'TileClicked',
        onLogs(logs) {
            logs.forEach((log) => {
                // Refetch game state when tiles are clicked
                refetchGameState();
            });
        },
    });

    // Auto-reveal pending clicks when target block is reached
    useEffect(() => {
        if (!blockNumber) return;

        pendingClicks.forEach((click, requestId) => {
            // Check if we've reached the target block
            if (blockNumber >= click.targetBlock) {
                // Auto-reveal this click
                revealOutcome(Number(requestId));

                // Remove from pending clicks
                setPendingClicks(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(requestId);
                    return newMap;
                });
            }
        });
    }, [blockNumber, pendingClicks]);

    const clickTile = (tileIndex: number) => {
        if (!fee) return;
        writeContract({
            address: BASESWEEPER_ADDRESS,
            abi: BASESWEEPER_ABI,
            functionName: 'click',
            args: [BigInt(tileIndex)],
            value: fee,
        });
    };

    const revealOutcome = (requestId: number) => {
        writeContract({
            address: BASESWEEPER_ADDRESS,
            abi: BASESWEEPER_ABI,
            functionName: 'revealOutcome',
            args: [BigInt(requestId)],
        });
    };

    useEffect(() => {
        if (isConfirmed) {
            refetchGameState();
        }
    }, [isConfirmed, refetchGameState]);

    // Poll game state every 5 seconds to catch any missed updates
    useEffect(() => {
        const interval = setInterval(() => {
            refetchGameState();
        }, 5000);

        return () => clearInterval(interval);
    }, [refetchGameState]);

    return {
        gameId,
        gameState,
        fee,
        blockDelay,
        blockNumber,
        pendingClicks: Array.from(pendingClicks.values()),
        clickTile,
        revealOutcome,
        isPending: isWritePending || isConfirming,
        isConfirmed,
        hash
    };
}
