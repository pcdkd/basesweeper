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

    // Read Game ID (watch for changes to detect new games)
    const { data: gameId } = useReadContract({
        address: BASESWEEPER_ADDRESS,
        abi: BASESWEEPER_ABI,
        functionName: 'gameId',
        query: {
            refetchInterval: 5000, // Poll every 5 seconds
        }
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
                const { gameId: wonGameId, requestId } = log.args as {
                    gameId: bigint;
                    requestId: bigint;
                };

                // Remove the specific pending click that was fulfilled
                setPendingClicks(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(requestId);
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
                const { requestId } = log.args as { requestId: bigint };

                // Remove the specific pending click that was fulfilled
                setPendingClicks(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(requestId);
                    return newMap;
                });

                // Refetch game state when tiles are clicked
                refetchGameState();
            });
        },
    });

    // Watch for ClickRefunded events
    useWatchContractEvent({
        address: BASESWEEPER_ADDRESS,
        abi: BASESWEEPER_ABI,
        eventName: 'ClickRefunded',
        onLogs(logs) {
            logs.forEach((log) => {
                // When a click is refunded, we need to find and remove it from pending
                // The event doesn't include requestId, so we'll refetch game state
                // and the pending clicks will be cleaned up by the auto-reveal logic
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
                // Check if it's within the 256-block window
                const expiryBlock = click.targetBlock + 256n;

                if (blockNumber <= expiryBlock) {
                    // Auto-reveal this click (don't remove from pending - event will do that)
                    revealOutcome(Number(requestId));
                } else {
                    // Expired - try to rescue it
                    rescueExpiredClick(Number(requestId));
                }
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

    const rescueExpiredClick = (requestId: number) => {
        writeContract({
            address: BASESWEEPER_ADDRESS,
            abi: BASESWEEPER_ABI,
            functionName: 'rescueExpiredClick',
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
        rescueExpiredClick,
        isPending: isWritePending || isConfirming,
        isConfirmed,
        hash
    };
}
