const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "",
    payload: "",
    signature: ""
  },
  miniapp: {
    version: "1",
    name: "Basesweeper", 
    subtitle: "Onchain Minesweeper", 
    description: "Find the hidden base tile to win the pool!",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#0052FF",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["game", "base", "minesweeper", "onchain"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`, 
    tagline: "Sweep the Base",
    ogTitle: "Basesweeper",
    ogDescription: "Onchain Minesweeper on Base",
    ogImageUrl: `${ROOT_URL}/blue-hero.png`,
  },
} as const;

