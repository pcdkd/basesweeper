import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { BASESWEEPER_ABI, BASESWEEPER_ADDRESS } from '../contracts/abi';
import { useState, useEffect } from 'react';

export function useBasesweeper() {
    const { address } = useAccount();
    const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    });

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

    useEffect(() => {
        if (isConfirmed) {
            refetchGameState();
        }
    }, [isConfirmed, refetchGameState]);

    return {
        gameId,
        gameState,
        fee,
        clickTile,
        isPending: isWritePending || isConfirming,
        isConfirmed,
        hash
    };
}
