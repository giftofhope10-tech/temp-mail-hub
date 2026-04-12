const DOMAINS = ["kameti.online", "giftofhop.online", "globaljobpoint.com"];

const adjectives = ["cool", "fast", "wild", "dark", "blue", "red", "zen", "hot", "ice", "pro", "ace", "max", "top", "neo", "sky"];
const nouns = ["mail", "fox", "wolf", "bear", "hawk", "star", "bolt", "wave", "fire", "byte", "node", "flux", "core", "dash", "link"];

export function getAvailableDomains() {
  return DOMAINS;
}

export function generateRandomUsername(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${adj}${noun}${num}`;
}

export function generateEmail(domain?: string): { username: string; domain: string; email: string } {
  const username = generateRandomUsername();
  const selectedDomain = domain || DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  return {
    username,
    domain: selectedDomain,
    email: `${username}@${selectedDomain}`,
  };
}

export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
