'use client';

export default function Mechanics() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">How Basesweeper Works</h2>
                <p className="text-gray-600 mb-4">
                    Basesweeper is an onchain lottery game inspired by Minesweeper, but with unique mechanics designed for blockchain fairness.
                </p>
            </div>

            <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Game Rules</h3>
                <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                        <span className="text-[#0052FF] font-bold mr-2">•</span>
                        <span><strong>Pay to Play:</strong> Each click costs 0.0008 ETH</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-[#0052FF] font-bold mr-2">•</span>
                        <span><strong>Growing Pool:</strong> All fees accumulate in the game pool</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-[#0052FF] font-bold mr-2">•</span>
                        <span><strong>Winner Takes All:</strong> The winning player receives the entire pool</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-[#0052FF] font-bold mr-2">•</span>
                        <span><strong>New Game Starts:</strong> After a win, a fresh game begins automatically</span>
                    </li>
                </ul>
            </div>

            <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Important: Not Traditional Minesweeper</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <p className="text-gray-800">
                        <strong className="text-[#0052FF]">Every click has an independent 1 in 9 chance to win.</strong>
                    </p>
                    <p className="text-gray-700 text-sm">
                        Unlike traditional Minesweeper where one mine is hidden at the start, Basesweeper uses a <strong>lottery-style mechanic</strong>:
                    </p>
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start">
                            <span className="text-[#0052FF] mr-2">→</span>
                            <span>Each click is revealed using future blockchain data (blockhash)</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-[#0052FF] mr-2">→</span>
                            <span>Your odds remain 11.1% (1/9) regardless of previous clicks</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-[#0052FF] mr-2">→</span>
                            <span>Clearing 8 tiles doesn't guarantee the 9th tile wins</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-[#0052FF] mr-2">→</span>
                            <span>This design ensures <strong>fairness</strong> - no one can predict outcomes</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">How Randomness Works</h3>
                <div className="space-y-3 text-gray-700">
                    <p>
                        Basesweeper uses <strong>blockhash-based randomness</strong> for provably fair outcomes:
                    </p>
                    <ol className="space-y-3 ml-4">
                        <li>
                            <strong className="text-[#0052FF]">1. Click a Tile</strong>
                            <p className="text-sm text-gray-600 mt-1">Your transaction creates a "pending click" and records a target block (3 blocks in the future)</p>
                        </li>
                        <li>
                            <strong className="text-[#0052FF]">2. Wait ~36 Seconds</strong>
                            <p className="text-sm text-gray-600 mt-1">Base Sepolia produces a new block approximately every 12 seconds</p>
                        </li>
                        <li>
                            <strong className="text-[#0052FF]">3. Automatic Reveal</strong>
                            <p className="text-sm text-gray-600 mt-1">Once the target block is mined, the outcome is revealed using that block's hash as a randomness source</p>
                        </li>
                        <li>
                            <strong className="text-[#0052FF]">4. Outcome Determined</strong>
                            <p className="text-sm text-gray-600 mt-1">The blockhash determines if you won (1/9 chance) or lost</p>
                        </li>
                    </ol>
                </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Why Blockhash?</h3>
                <div className="space-y-3 text-gray-700">
                    <ul className="space-y-3">
                        <li className="flex items-start">
                            <span className="text-green-500 font-bold mr-2">✓</span>
                            <div>
                                <strong>Cost-Effective:</strong>
                                <p className="text-sm text-gray-600">No oracle fees (like Chainlink VRF which costs ~$1-2 per game)</p>
                            </div>
                        </li>
                        <li className="flex items-start">
                            <span className="text-green-500 font-bold mr-2">✓</span>
                            <div>
                                <strong>Secure:</strong>
                                <p className="text-sm text-gray-600">Future blockhashes cannot be predicted at the time of your click</p>
                            </div>
                        </li>
                        <li className="flex items-start">
                            <span className="text-green-500 font-bold mr-2">✓</span>
                            <div>
                                <strong>Fast:</strong>
                                <p className="text-sm text-gray-600">Results in ~36 seconds instead of waiting for oracle responses</p>
                            </div>
                        </li>
                        <li className="flex items-start">
                            <span className="text-yellow-500 font-bold mr-2">⚠</span>
                            <div>
                                <strong>Trade-off:</strong>
                                <p className="text-sm text-gray-600">Validators could theoretically manipulate results, but it's economically impractical for small stakes</p>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Fund Safety</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <p className="text-gray-800">
                        <strong>Automatic Rescue System:</strong> If a reveal transaction fails or is missed, the contract has a built-in rescue mechanism.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start">
                            <span className="text-[#0052FF] mr-2">→</span>
                            <span>You have 256 blocks (~50 minutes) to reveal each click</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-[#0052FF] mr-2">→</span>
                            <span>After expiration, anyone can trigger a refund back to you</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-[#0052FF] mr-2">→</span>
                            <span>The frontend automatically attempts reveals and rescues</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Contract</h3>
                <p className="text-gray-700 text-sm mb-2">
                    Basesweeper is fully open source and deployed on Base Sepolia testnet.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-mono text-gray-600 break-all">
                        0x78C8899921D71CD565f66379FffA082C1AE41cC3
                    </p>
                </div>
            </div>
        </div>
    );
}
