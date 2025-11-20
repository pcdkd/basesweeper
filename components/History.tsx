

export default function History() {
    // TODO: Implement event fetching for history
    // For now, this is a placeholder structure

    return (
        <div className="w-full max-w-2xl mt-8 p-4 border rounded-lg">
            <h2 className="text-2xl font-bold mb-4">Game History</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winner</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pool (ETH)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {/* Placeholder row */}
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p className="text-sm text-gray-500 mt-2 italic">
                * History requires event indexing (not implemented in this demo)
            </p>
        </div>
    );
}
