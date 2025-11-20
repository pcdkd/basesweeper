"use client";
import { useState, useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import Grid from "../components/Grid";
import History from "../components/History";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'game' | 'history'>('game');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
        <header className="w-full max-w-2xl flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-[#0052FF]">Basesweeper</h1>
          <div>
            <button className="px-4 py-2 bg-[#0052FF] text-white rounded-lg text-sm font-medium hover:bg-[#0040DD]">
              Connect Wallet
            </button>
          </div>
        </header>
        <div className="w-full max-w-2xl mb-6 flex space-x-4 border-b border-gray-200">
          <button className="pb-2 px-4 font-medium text-[#0052FF] border-b-2 border-[#0052FF]">
            Game
          </button>
          <button className="pb-2 px-4 font-medium text-gray-500 hover:text-gray-700">
            History
          </button>
        </div>
        <main className="w-full max-w-2xl bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col items-center justify-center p-4">
            <div className="mb-4 text-xl font-bold">Pool: 0.0000 ETH</div>
            <div className="text-gray-500">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  return <MountedHome activeTab={activeTab} setActiveTab={setActiveTab} />;
}

function MountedHome({ activeTab, setActiveTab }: { activeTab: 'game' | 'history', setActiveTab: (tab: 'game' | 'history') => void }) {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <header className="w-full max-w-2xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[#0052FF]">Basesweeper</h1>
        <div>
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="px-4 py-2 bg-[#0052FF] text-white rounded-lg text-sm font-medium hover:bg-[#0040DD]"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <div className="w-full max-w-2xl mb-6 flex space-x-4 border-b border-gray-200">
        <button
          className={`pb-2 px-4 font-medium ${activeTab === 'game'
            ? 'text-[#0052FF] border-b-2 border-[#0052FF]'
            : 'text-gray-500 hover:text-gray-700'
            }`}
          onClick={() => setActiveTab('game')}
        >
          Game
        </button>
        <button
          className={`pb-2 px-4 font-medium ${activeTab === 'history'
            ? 'text-[#0052FF] border-b-2 border-[#0052FF]'
            : 'text-gray-500 hover:text-gray-700'
            }`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      <main className="w-full max-w-2xl bg-white rounded-xl shadow-sm p-6">
        {activeTab === 'game' ? <Grid /> : <History />}
      </main>
    </div>
  );
}
