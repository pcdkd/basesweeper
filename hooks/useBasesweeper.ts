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

    // Track which requestIds have already had reveal initiated to prevent duplicate calls
    const [revealingRequestIds, setRevealingRequestIds] = useState<Set<bigint>>(new Set());

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

                // Remove from revealing set
                setRevealingRequestIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(requestId);
                    return newSet;
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

                // Remove from revealing set
                setRevealingRequestIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(requestId);
                    return newSet;
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
                const { gameId, tileIndex, player } = log.args as {
                    gameId: bigint;
                    tileIndex: bigint;
                    player: string;
                };

                // Find and remove the corresponding pending click
                setPendingClicks(prev => {
                    const newMap = new Map(prev);
                    // Find requestId that matches this refund
                    for (const [requestId, click] of newMap.entries()) {
                        if (click.tileIndex === tileIndex && click.player.toLowerCase() === player.toLowerCase()) {
                            newMap.delete(requestId);
                            // Also remove from revealing set
                            setRevealingRequestIds(prevSet => {
                                const newSet = new Set(prevSet);
                                newSet.delete(requestId);
                                return newSet;
                            });
                            break;
                        }
                    }
                    return newMap;
                });

                refetchGameState();
            });
        },
    });

    // Auto-reveal pending clicks when target block is reached
    useEffect(() => {
        if (!blockNumber) return;

        pendingClicks.forEach((click, requestId) => {
            // Skip if we've already initiated reveal for this requestId
            if (revealingRequestIds.has(requestId)) return;

            // Check if we've reached the target block
            if (blockNumber >= click.targetBlock) {
                // Check if it's within the 256-block window
                const expiryBlock = click.targetBlock + 256n;

                if (blockNumber <= expiryBlock) {
                    // Mark as revealing to prevent duplicate calls
                    setRevealingRequestIds(prev => new Set(prev).add(requestId));
                    // Auto-reveal this click (don't remove from pending - event will do that)
                    revealOutcome(Number(requestId));
                } else {
                    // Mark as revealing to prevent duplicate calls
                    setRevealingRequestIds(prev => new Set(prev).add(requestId));
                    // Expired - try to rescue it
                    rescueExpiredClick(Number(requestId));
                }
            }
        });
    }, [blockNumber, pendingClicks, revealingRequestIds]);

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
