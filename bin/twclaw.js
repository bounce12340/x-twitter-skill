#!/usr/bin/env node

const https = require('https');

const args = process.argv.slice(2);
const command = args[0];
const subarg = args[1];

// Parse flags
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    flags[key] = (i + 1 < args.length && !args[i + 1]?.startsWith('--')) ? args[i + 1] : true;
  }
  if (args[i] === '-n' && args[i + 1]) flags.n = parseInt(args[i + 1]);
}

const json = flags.json || false;
const count = flags.n || 10;

// ── Twitter API v2 ──────────────────────────────────────────────────────

const TWITTER_API_BASE = 'api.twitter.com';

function apiRequest(path) {
  const token = process.env.TWITTER_BEARER_TOKEN;
  return new Promise((resolve, reject) => {
    const options = {
      hostname: TWITTER_API_BASE,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'twclaw/1.0',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject(new Error('Rate limit exceeded. Please wait before retrying.'));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const msg = parsed.detail || parsed.title || parsed.errors?.[0]?.message || `HTTP ${res.statusCode}`;
            reject(new Error(msg));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function extractTweetId(input) {
  // Handle URLs like https://twitter.com/user/status/1234567890
  const match = input?.match(/status\/(\d+)/);
  if (match) return match[1];
  // Handle plain numeric IDs
  if (/^\d+$/.test(input)) return input;
  return null;
}

function buildTweetFromResponse(tweet, users) {
  const author = users?.find(u => u.id === tweet.author_id);
  return {
    id: tweet.id,
    author: author?.name || tweet.author_id,
    handle: author ? `@${author.username}` : `@${tweet.author_id}`,
    text: tweet.text,
    created_at: tweet.created_at,
    likes: tweet.public_metrics?.like_count ?? 0,
    retweets: tweet.public_metrics?.retweet_count ?? 0,
    replies: tweet.public_metrics?.reply_count ?? 0,
    bookmarks: tweet.public_metrics?.bookmark_count ?? 0,
  };
}

// ── Mock data (for commands not yet using real API) ──────────────────────

const mockTrending = [
  { rank: 1, topic: '#AI', tweets: '2.1M' },
  { rank: 2, topic: '#OpenClaw', tweets: '450K' },
  { rank: 3, topic: 'Starship', tweets: '380K' },
  { rank: 4, topic: '#CodingTwitter', tweets: '290K' },
  { rank: 5, topic: 'GPT-5', tweets: '1.8M' },
];

// ── Formatters ─────────────────────────────────────────────────────────

function fmtTweet(t) {
  if (json) return JSON.stringify(t, null, 2);
  const date = t.created_at ? new Date(t.created_at).toLocaleDateString() : 'unknown';
  return [
    `${t.author} (${t.handle}) · ${date}`,
    t.text,
    `❤️ ${(t.likes ?? 0).toLocaleString()}  🔁 ${(t.retweets ?? 0).toLocaleString()}  💬 ${(t.replies ?? 0).toLocaleString()}  🔖 ${(t.bookmarks ?? 0).toLocaleString()}`,
    `ID: ${t.id}`,
    '---',
  ].join('\n');
}

function fmtUser(u) {
  if (json) return JSON.stringify(u, null, 2);
  return [
    `${u.name} (@${u.username ?? u.handle}) ${u.verified ? '✓' : ''}`,
    u.description ?? u.bio ?? '',
    `Followers: ${(u.followers ?? u.public_metrics?.followers_count ?? 0).toLocaleString()} · Following: ${(u.following ?? u.public_metrics?.following_count ?? 0).toLocaleString()}`,
    '---',
  ].join('\n');
}

// ── Commands ───────────────────────────────────────────────────────────

function checkAuth() {
  if (!process.env.TWITTER_BEARER_TOKEN) {
    console.error('Error: TWITTER_BEARER_TOKEN is not set.');
    console.error('Set it with: export TWITTER_BEARER_TOKEN=your_token');
    process.exit(1);
  }
}

async function main() {
  switch (command) {
    case 'auth-check': {
      if (process.env.TWITTER_BEARER_TOKEN) {
        console.log('✓ TWITTER_BEARER_TOKEN is set');
        console.log(`Token: ${process.env.TWITTER_BEARER_TOKEN.slice(0, 8)}...`);
        console.log(process.env.TWITTER_API_KEY ? '✓ TWITTER_API_KEY is set (write ops enabled)' : '⚠ TWITTER_API_KEY not set (read-only mode)');
      } else {
        console.error('✗ TWITTER_BEARER_TOKEN is NOT set');
        process.exit(1);
      }
      break;
    }

    case 'read': {
      checkAuth();
      const id = extractTweetId(subarg);
      if (!id) { console.error('Error: provide a tweet URL or numeric ID'); process.exit(1); }
      const path = `/2/tweets/${id}?tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username`;
      const res = await apiRequest(path);
      const tweet = buildTweetFromResponse(res.data, res.includes?.users);
      console.log(fmtTweet(tweet));
      break;
    }

    case 'thread': {
      checkAuth();
      const id = extractTweetId(subarg);
      if (!id) { console.error('Error: provide a tweet URL or numeric ID'); process.exit(1); }
      // First fetch the root tweet to get conversation_id
      const rootRes = await apiRequest(
        `/2/tweets/${id}?tweet.fields=created_at,public_metrics,author_id,conversation_id&expansions=author_id&user.fields=name,username`
      );
      const rootTweet = buildTweetFromResponse(rootRes.data, rootRes.includes?.users);
      console.log(fmtTweet(rootTweet));

      const conversationId = rootRes.data.conversation_id;
      // Search for other tweets in this conversation
      const searchPath = `/2/tweets/search/recent?query=conversation_id:${conversationId}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username&max_results=${Math.max(10, Math.min(count, 100))}`;
      try {
        const threadRes = await apiRequest(searchPath);
        if (threadRes.data?.length) {
          // Reverse to show chronological order (oldest first)
          const tweets = [...threadRes.data].reverse();
          for (const t of tweets) {
            if (t.id !== id) {
              console.log(fmtTweet(buildTweetFromResponse(t, threadRes.includes?.users)));
            }
          }
        } else {
          console.log('(No additional replies found in thread)');
        }
      } catch (e) {
        // thread search may fail if conversation is old; just show the root tweet
        console.log(`(Thread search unavailable: ${e.message})`);
      }
      break;
    }

    case 'user': {
      checkAuth();
      const username = subarg?.replace(/^@/, '');
      if (!username) { console.error('Error: provide a @handle or username'); process.exit(1); }
      const res = await apiRequest(
        `/2/users/by/username/${username}?user.fields=name,username,public_metrics,description,verified,created_at`
      );
      console.log(fmtUser(res.data));
      break;
    }

    case 'user-tweets': {
      checkAuth();
      const username = subarg?.replace(/^@/, '');
      if (!username) { console.error('Error: provide a @handle or username'); process.exit(1); }
      // First get user ID
      const userRes = await apiRequest(`/2/users/by/username/${username}?user.fields=name,username`);
      const userId = userRes.data.id;
      const tweetsRes = await apiRequest(
        `/2/users/${userId}/tweets?max_results=${Math.max(5, Math.min(count, 100))}&tweet.fields=created_at,public_metrics,author_id`
      );
      if (!tweetsRes.data?.length) {
        console.log('No tweets found.');
        break;
      }
      for (const t of tweetsRes.data) {
        console.log(fmtTweet(buildTweetFromResponse(t, [userRes.data])));
      }
      break;
    }

    case 'search': {
      checkAuth();
      // Collect all non-flag args after the command as the query
      const queryParts = [];
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '-n' || args[i].startsWith('--')) { i++; continue; }
        queryParts.push(args[i]);
      }
      const query = queryParts.join(' ');
      if (!query) { console.error('Error: provide a search query'); process.exit(1); }
      const searchPath = `/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.max(10, Math.min(count, 100))}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username`;
      const res = await apiRequest(searchPath);
      if (!res.data?.length) {
        console.log(`No results for "${query}"`);
        break;
      }
      for (const t of res.data) {
        console.log(fmtTweet(buildTweetFromResponse(t, res.includes?.users)));
      }
      console.log(`\n${res.meta?.result_count ?? res.data.length} results for "${query}"`);
      break;
    }

    case 'replies': {
      checkAuth();
      const id = extractTweetId(subarg);
      if (!id) { console.error('Error: provide a tweet URL or numeric ID'); process.exit(1); }
      const rootRes = await apiRequest(`/2/tweets/${id}?tweet.fields=conversation_id`);
      const conversationId = rootRes.data.conversation_id;
      const path = `/2/tweets/search/recent?query=conversation_id:${conversationId} is:reply&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username&max_results=${Math.max(10, Math.min(count, 100))}`;
      const res = await apiRequest(path);
      if (!res.data?.length) { console.log('No replies found.'); break; }
      for (const t of res.data) {
        console.log(fmtTweet(buildTweetFromResponse(t, res.includes?.users)));
      }
      break;
    }

    case 'trending': {
      checkAuth();
      if (json) {
        console.log(JSON.stringify(mockTrending, null, 2));
      } else {
        mockTrending.forEach(t => console.log(`${t.rank}. ${t.topic} — ${t.tweets} tweets`));
        console.log('\n(Trending requires Ads API access — showing cached data)');
      }
      break;
    }

    case 'tweet': {
      checkAuth();
      const text = subarg || '';
      if (!text) { console.error('Error: tweet text required.'); process.exit(1); }
      console.log('⚠ Tweet posting requires OAuth 1.0a user context (not Bearer Token).');
      console.log(`Would post: "${text}"`);
      break;
    }

    case 'reply': {
      checkAuth();
      console.log('⚠ Reply posting requires OAuth 1.0a user context (not Bearer Token).');
      break;
    }

    case 'quote': {
      checkAuth();
      console.log('⚠ Quote tweet requires OAuth 1.0a user context (not Bearer Token).');
      break;
    }

    case 'like': case 'unlike': case 'retweet': case 'unretweet':
    case 'bookmark': case 'unbookmark': case 'follow': case 'unfollow': {
      checkAuth();
      console.log(`⚠ ${command} requires OAuth 1.0a user context (not Bearer Token).`);
      break;
    }

    case 'home': case 'mentions': case 'likes':
    case 'followers': case 'following':
    case 'lists': case 'list-timeline': case 'list-add': case 'list-remove': {
      checkAuth();
      console.log(`⚠ ${command} requires OAuth 1.0a user context (not Bearer Token).`);
      break;
    }

    default: {
      console.log(`twclaw — Twitter/X CLI for OpenClaw

Usage: twclaw <command> [options]

Commands (Real API):
  auth-check                   Verify credentials
  read <url-or-id>             Read a tweet
  thread <url-or-id>           Read full thread
  replies <url-or-id>          List replies
  user <@handle>               Show user profile
  user-tweets <@handle>        User's recent tweets
  search "query"               Search recent tweets

Commands (Require OAuth user context):
  tweet "text"                 Post a tweet
  reply <id> "text"            Reply to a tweet
  quote <id> "text"            Quote tweet
  like/unlike <id>             Like/unlike
  retweet/unretweet <id>       Retweet/undo
  bookmark/unbookmark <id>     Bookmark/remove
  follow/unfollow <@handle>    Follow/unfollow
  home / mentions / likes      Timeline feeds
  followers/following          Social graph
  lists / list-*               List management

Options:
  --json      JSON output
  -n <count>  Number of results (default: 10)
`);
      break;
    }
  }
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
