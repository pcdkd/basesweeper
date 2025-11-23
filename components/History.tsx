'use client';

import { useState, useEffect } from 'react';
import { getGameHistory, type Game } from '../lib/api';

export default function History() {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getGameHistory()
            .then(data => {
                setGames(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load history:', err);
                setError('Failed to load game history. Make sure the indexer is running.');
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="w-full max-w-2xl mt-8 p-4 border rounded-lg">
                <h2 className="text-2xl font-bold mb-4">Game History</h2>
                <div className="flex justify-center items-center py-8">
                    <div className="text-gray-500">Loading history...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-2xl mt-8 p-4 border rounded-lg">
                <h2 className="text-2xl font-bold mb-4">Game History</h2>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <p className="text-sm text-yellow-800">{error}</p>
                    <p className="text-xs text-yellow-600 mt-2">
                        Run: <code className="bg-yellow-100 px-1 rounded">npm run indexer</code> to start the indexer
                    </p>
                </div>
            </div>
        );
    }

    if (games.length === 0) {
        return (
            <div className="w-full max-w-2xl mt-8 p-4 border rounded-lg">
                <h2 className="text-2xl font-bold mb-4">Game History</h2>
                <div className="text-center py-8 text-gray-500">
                    No completed games yet. Play to create history!
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mt-8 p-4 border rounded-lg">
            <h2 className="text-2xl font-bold mb-4">Game History</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Game ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Winner
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pool (ETH)
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Ended
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {games.map((game) => (
                            <tr key={game.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    #{game.id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                                    {game.winner ? (
                                        <a
                                            href={`https://sepolia.basescan.org/address/${game.winner}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                        >
                                            {game.winner.slice(0, 6)}...{game.winner.slice(-4)}
                                        </a>
                                    ) : (
                                        '-'
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {(Number(game.pool) / 1e18).toFixed(4)} ETH
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {game.ended_at
                                        ? new Date(Number(game.ended_at) * 1000).toLocaleString()
                                        : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
                Showing {games.length} completed game{games.length !== 1 ? 's' : ''}
            </p>
        </div>
    );
}
