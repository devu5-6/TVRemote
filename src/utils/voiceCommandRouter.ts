export type VoiceCommandRoute =
  | { kind: 'youtube'; query: string }
  | { kind: 'tvSearch'; query: string };

const YOUTUBE_MENTION = /\b(?:on|in|from|at)?\s*you\s?tube\b/i;
// One leading command verb we can safely drop for a cleaner search query
// ("play shubh new music" -> "shubh new music").
const LEADING_VERB = /^(?:please\s+)?(?:play|search for|search|find|watch|open|show me|show|put on)\s+/i;

/**
 * Decide what to do on the TV for a spoken command.
 *
 * "play shubh new music on youtube" -> YouTube search for "shubh new music".
 * Anything that doesn't mention YouTube -> the TV's own Google search UI.
 */
export function routeVoiceCommand(rawText: string): VoiceCommandRoute {
  const text = rawText.replace(/\s+/g, ' ').trim();

  if (YOUTUBE_MENTION.test(text)) {
    const query = text.replace(YOUTUBE_MENTION, ' ').replace(LEADING_VERB, '').replace(/\s+/g, ' ').trim();
    return { kind: 'youtube', query };
  }

  return { kind: 'tvSearch', query: text };
}

/** Deep link that opens the YouTube TV app straight on the search results. */
export function youtubeSearchLink(query: string): string {
  if (!query) return 'vnd.youtube://';
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
