import { useBasesweeper } from '../hooks/useBasesweeper';
import { useAccount } from 'wagmi';

export default function Grid() {
    const { gameState, clickTile, isPending, pendingClicks } = useBasesweeper();
    const { isConnected } = useAccount();

    // gameState: [pool, winner, active, clickedMask]
    const clickedMask = gameState ? gameState[3] : 0n;
    const isActive = gameState ? gameState[2] : false;
    const pool = gameState ? gameState[0] : 0n;

    const isClicked = (index: number) => {
        return (clickedMask & (1n << BigInt(index))) !== 0n;
    };

    const isPendingReveal = (index: number) => {
        // Check if this tile index is in pending clicks (clicked but not yet revealed)
        return pendingClicks.some(click => Number(click.tileIndex) === index);
    };

    const handleTileClick = (index: number) => {
        if (!isConnected) return;
        if (isClicked(index)) return;
        if (isPendingReveal(index)) return;
        clickTile(index);
    };

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="mb-4 text-xl font-bold">
                Pool: {pool ? (Number(pool) / 1e18).toFixed(4) : '0.0000'} ETH
            </div>

            <div className="grid grid-cols-3 gap-1 bg-gray-200 p-2 rounded-lg" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                {Array.from({ length: 9 }).map((_, i) => {
                    const clicked = isClicked(i);
                    const pending = isPendingReveal(i);
                    const isAvailable = !clicked && !pending;

                    return (
                        <button
                            key={i}
                            onClick={() => handleTileClick(i)}
                            disabled={clicked || pending || !isActive || isPending}
                            className={`
                w-16 h-16 sm:w-20 sm:h-20 rounded-sm transition-colors duration-200 font-semibold text-sm
                ${pending
                                    ? 'bg-yellow-500 cursor-not-allowed animate-pulse text-white'
                                    : clicked
                                        ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                                        : 'bg-[#0052FF] hover:bg-[#0040DD] active:bg-[#0030BB] text-white'}
                ${!isActive ? 'opacity-50 cursor-not-allowed' : ''}
              `}
                            title={`Tile ${i}${pending ? ' (Pending Reveal...)' : clicked ? ' (Revealed - Loss)' : ''}`}
                        >
                            {pending && '⏳'}
                            {clicked && '❌'}
                        </button>
                    );
                })}
            </div>

            {!isActive && gameState && (
                <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-lg">
                    Game Over! Winner: {gameState[1]?.slice(0, 6)}...{gameState[1]?.slice(-4)}
                </div>
            )}

            {isPending && (
                <div className="mt-2 text-yellow-600">
                    Transaction Pending...
                </div>
            )}

            {pendingClicks.length > 0 && (
                <div className="mt-2 text-yellow-600 text-sm">
                    {pendingClicks.length} tile{pendingClicks.length > 1 ? 's' : ''} awaiting reveal... (~36 seconds)
                </div>
            )}
        </div>
    );
}
