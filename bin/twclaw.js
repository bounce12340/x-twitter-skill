#!/usr/bin/env node

const https = require('https');
const http = require('http');

const args = process.argv.slice(2);
const command = args[0];
const subarg = args[1];

// Parse flags
const flags = {};
const valueFlags = new Set(['account', 'backend', 'count', 'cursor', 'query-type', 'woeid']);
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const hasValue = valueFlags.has(key) && i + 1 < args.length && !args[i + 1]?.startsWith('-');
    flags[key] = hasValue ? args[++i] : true;
  }
  if (args[i] === '-n' && args[i + 1]) flags.n = parseInt(args[++i], 10);
}

const json = flags.json || false;
const parsedCount = Number.parseInt(flags.n || flags.count || 10, 10);
const count = Number.isFinite(parsedCount) ? parsedCount : 10;

function resolveBackend(value) {
  const normalized = String(value || 'twitter').trim().toLowerCase();
  if (['hermes', 'hermes-tweet', 'xquik'].includes(normalized)) return 'xquik';
  return 'twitter';
}

const backend = resolveBackend(flags.backend || process.env.X_TWITTER_BACKEND || process.env.TWCLAW_BACKEND);

function usingXquikBackend() {
  return backend === 'xquik';
}

function positionalArgs(startIndex = 1) {
  const output = [];
  const positionalValueFlags = new Set(['-n', '--account', '--backend', '--count', '--cursor', '--query-type', '--woeid']);
  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];
    if (positionalValueFlags.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith('--')) continue;
    output.push(arg);
  }
  return output;
}

function requestJson(url, options, body) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'http:' ? http : https;
    const req = transport.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
          return;
        }
        if (res.statusCode === 429) {
          reject(new Error('Rate limit exceeded. Please wait before retrying.'));
          return;
        }
        if (res.statusCode >= 400) {
          const msg = parsed.detail || parsed.title || parsed.error || parsed.errors?.[0]?.message || `HTTP ${res.statusCode}`;
          reject(new Error(msg));
        } else {
          resolve(parsed);
        }
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Twitter API v2 ──────────────────────────────────────────────────────

const TWITTER_API_BASE = 'api.twitter.com';

function apiRequest(path) {
  const token = process.env.TWITTER_BEARER_TOKEN;
  const url = new URL(`https://${TWITTER_API_BASE}${path}`);
  return requestJson(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'twclaw/1.0',
    },
  });
}

// ── Hermes Tweet / Xquik backend ────────────────────────────────────────

const DEFAULT_XQUIK_BASE_URL = 'https://xquik.com';

function xquikBaseUrl() {
  return `${(process.env.XQUIK_BASE_URL || DEFAULT_XQUIK_BASE_URL).replace(/\/+$/, '')}/`;
}

function buildXquikUrl(path, query = {}, base = xquikBaseUrl()) {
  const url = new URL(path.replace(/^\//, ''), base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function buildXquikHeaders(key = process.env.XQUIK_API_KEY || '', hasBody = false) {
  const headers = { 'User-Agent': 'twclaw/1.0' };
  if (key.startsWith('xq_')) {
    headers['x-api-key'] = key;
  } else if (key) {
    headers.authorization = `Bearer ${key}`;
  }
  if (hasBody) headers['content-type'] = 'application/json';
  return headers;
}

function buildXquikTweetBody(account, text, options = {}) {
  const body = { account, text };
  if (options.replyToTweetId) {
    body.reply_to_tweet_id = options.replyToTweetId;
  }
  if (options.quoteTweetId) {
    body.attachment_url = `https://x.com/i/status/${options.quoteTweetId}`;
  }
  return body;
}

function xquikActionsEnabled() {
  return String(process.env.HERMES_TWEET_ENABLE_ACTIONS || '').toLowerCase() === 'true';
}

function xquikAccount() {
  return flags.account || process.env.XQUIK_ACCOUNT || process.env.X_TWITTER_ACCOUNT || '';
}

async function xquikRequest(method, path, query, body) {
  const key = process.env.XQUIK_API_KEY || '';
  if (!key) throw new Error('XQUIK_API_KEY is not set.');
  const hasBody = body !== undefined;
  const url = buildXquikUrl(path, query);
  return requestJson(url, {
    method,
    headers: buildXquikHeaders(key, hasBody),
  }, body);
}

function unwrapPayload(payload) {
  if (payload?.data && !Array.isArray(payload.data) && typeof payload.data === 'object') {
    return payload.data;
  }
  return payload;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickArray(payload, names) {
  if (Array.isArray(payload)) return payload;
  const unwrapped = unwrapPayload(payload);
  if (Array.isArray(unwrapped)) return unwrapped;
  for (const name of names) {
    const value = unwrapped?.[name] ?? payload?.[name];
    if (Array.isArray(value)) return value;
  }
  for (const value of Object.values(unwrapped || {})) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizeTweet(input) {
  const tweet = unwrapPayload(input?.tweet || input?.post || input);
  const author = tweet?.author || tweet?.user || tweet?.core?.user_results?.result || {};
  const legacy = author.legacy || {};
  const username = firstValue(tweet?.username, tweet?.handle, author.username, author.screen_name, legacy.screen_name);
  const handle = username ? `@${String(username).replace(/^@/, '')}` : '@unknown';
  return {
    id: String(firstValue(tweet?.id, tweet?.tweetId, tweet?.tweet_id, tweet?.rest_id, tweet?.id_str, '')),
    author: firstValue(tweet?.authorName, tweet?.author_name, tweet?.name, author.name, legacy.name, username, 'Unknown'),
    handle,
    text: firstValue(tweet?.fullText, tweet?.full_text, tweet?.text, tweet?.content, tweet?.body, legacy.full_text, ''),
    created_at: firstValue(tweet?.createdAt, tweet?.created_at, tweet?.created, tweet?.timestamp, legacy.created_at),
    likes: toCount(firstValue(tweet?.likeCount, tweet?.likes, tweet?.favorite_count, tweet?.public_metrics?.like_count, legacy.favorite_count)),
    retweets: toCount(firstValue(tweet?.retweetCount, tweet?.retweets, tweet?.public_metrics?.retweet_count, legacy.retweet_count)),
    replies: toCount(firstValue(tweet?.replyCount, tweet?.replies, tweet?.public_metrics?.reply_count, legacy.reply_count)),
    bookmarks: toCount(firstValue(tweet?.bookmarkCount, tweet?.bookmarks, tweet?.public_metrics?.bookmark_count, legacy.bookmark_count)),
  };
}

function normalizeTweets(payload) {
  return pickArray(payload, ['tweets', 'results', 'items', 'data', 'thread', 'replies', 'bookmarks', 'timeline'])
    .map(normalizeTweet)
    .filter(tweet => tweet.id || tweet.text);
}

function normalizeUser(input) {
  const user = unwrapPayload(input?.user || input?.profile || input);
  const legacy = user?.legacy || {};
  const username = firstValue(user?.username, user?.screen_name, user?.handle, legacy.screen_name, user?.id, 'unknown');
  return {
    id: String(firstValue(user?.id, user?.userId, user?.rest_id, user?.id_str, '')),
    name: firstValue(user?.name, legacy.name, username),
    username: String(username).replace(/^@/, ''),
    description: firstValue(user?.description, user?.bio, legacy.description) || '',
    verified: Boolean(firstValue(user?.verified, user?.isVerified, legacy.verified, false)),
    followers: toCount(firstValue(user?.followers, user?.followersCount, user?.public_metrics?.followers_count, legacy.followers_count)),
    following: toCount(firstValue(user?.following, user?.followingCount, user?.public_metrics?.following_count, legacy.friends_count)),
  };
}

function normalizeUsers(payload) {
  return pickArray(payload, ['users', 'results', 'items', 'data', 'followers', 'following'])
    .map(normalizeUser)
    .filter(user => user.id || user.username);
}

function printTweets(payload, emptyMessage) {
  const tweets = normalizeTweets(payload);
  if (!tweets.length) {
    console.log(emptyMessage);
    return 0;
  }
  for (const tweet of tweets) console.log(fmtTweet(tweet));
  return tweets.length;
}

function printUsers(payload, emptyMessage) {
  const users = normalizeUsers(payload);
  if (!users.length) {
    console.log(emptyMessage);
    return 0;
  }
  for (const user of users) console.log(fmtUser(user));
  return users.length;
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

function fmtTrend(t, index) {
  if (json) return JSON.stringify(t, null, 2);
  const topic = t.topic || t.name || t.hashtag || t.query || 'unknown';
  const volume = t.tweets || t.tweet_volume || t.tweetVolume || t.volume || '';
  return `${t.rank || index + 1}. ${topic}${volume ? ` - ${volume} tweets` : ''}`;
}

// ── Commands ───────────────────────────────────────────────────────────

function checkAuth(options = {}) {
  if (usingXquikBackend()) {
    if (!process.env.XQUIK_API_KEY) {
      console.error('Error: XQUIK_API_KEY is not set.');
      console.error('Set it with: export XQUIK_API_KEY=xq_...');
      process.exit(1);
    }
    if (options.action && !xquikActionsEnabled()) {
      console.error('Error: Hermes Tweet actions are disabled.');
      console.error('Set HERMES_TWEET_ENABLE_ACTIONS=true only after the user confirms the write action.');
      process.exit(1);
    }
    return;
  }
  if (!process.env.TWITTER_BEARER_TOKEN) {
    console.error('Error: TWITTER_BEARER_TOKEN is not set.');
    console.error('Set it with: export TWITTER_BEARER_TOKEN=your_token');
    process.exit(1);
  }
}

function requireXquikAccount() {
  const account = xquikAccount();
  if (!account) {
    console.error('Error: XQUIK_ACCOUNT or --account is required for Hermes Tweet write actions.');
    process.exit(1);
  }
  return account;
}

function printActionResult(result, label) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const id = result?.id || result?.data?.id || result?.tweetId || result?.writeActionId || result?.data?.writeActionId;
  console.log(`${label}${id ? `: ${id}` : ''}`);
}

async function main() {
  switch (command) {
    case 'auth-check': {
      if (usingXquikBackend()) {
        if (process.env.XQUIK_API_KEY) {
          console.log('✓ Hermes Tweet/Xquik backend selected');
          console.log('✓ XQUIK_API_KEY is set');
          console.log(xquikActionsEnabled() ? '✓ HERMES_TWEET_ENABLE_ACTIONS is enabled' : '⚠ HERMES_TWEET_ENABLE_ACTIONS not set (read-only mode)');
          console.log(xquikAccount() ? '✓ XQUIK_ACCOUNT is set for write actions' : '⚠ XQUIK_ACCOUNT not set (write actions need --account)');
        } else {
          console.error('✗ XQUIK_API_KEY is NOT set');
          process.exit(1);
        }
      } else if (process.env.TWITTER_BEARER_TOKEN) {
        console.log('✓ Twitter API backend selected');
        console.log('✓ TWITTER_BEARER_TOKEN is set');
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
      if (usingXquikBackend()) {
        const res = await xquikRequest('GET', `/api/v1/x/tweets/${id}`);
        console.log(fmtTweet(normalizeTweet(res)));
        break;
      }
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
      if (usingXquikBackend()) {
        const res = await xquikRequest('GET', `/api/v1/x/tweets/${id}/thread`);
        printTweets(res, 'No thread tweets found.');
        break;
      }
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
      if (usingXquikBackend()) {
        const res = await xquikRequest('GET', `/api/v1/x/users/${encodeURIComponent(username)}`);
        console.log(fmtUser(normalizeUser(res)));
        break;
      }
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
      if (usingXquikBackend()) {
        const res = await xquikRequest('GET', `/api/v1/x/users/${encodeURIComponent(username)}/tweets`, {
          includeReplies: flags.replies ? 'true' : undefined,
        });
        printTweets(res, 'No tweets found.');
        break;
      }
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
      const query = positionalArgs(1).join(' ');
      if (!query) { console.error('Error: provide a search query'); process.exit(1); }
      if (usingXquikBackend()) {
        const res = await xquikRequest('GET', '/api/v1/x/tweets/search', {
          q: query,
          limit: count,
          queryType: flags.popular ? 'Top' : (flags['query-type'] || 'Latest'),
        });
        const resultCount = printTweets(res, `No results for "${query}"`);
        if (resultCount) console.log(`\n${resultCount} results for "${query}"`);
        break;
      }
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
      if (usingXquikBackend()) {
        const res = await xquikRequest('GET', `/api/v1/x/tweets/${id}/replies`, {
          cursor: flags.cursor,
        });
        printTweets(res, 'No replies found.');
        break;
      }
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
      if (usingXquikBackend()) {
        const res = await xquikRequest('GET', '/api/v1/x/trends', {
          woeid: flags.woeid,
          count,
        });
        const trends = pickArray(res, ['trends', 'topics', 'items', 'data']);
        if (json) {
          console.log(JSON.stringify(trends, null, 2));
        } else if (trends.length) {
          trends.forEach((trend, index) => console.log(fmtTrend(trend, index)));
        } else {
          console.log('No trends found.');
        }
        break;
      }
      if (json) {
        console.log(JSON.stringify(mockTrending, null, 2));
      } else {
        mockTrending.forEach(t => console.log(`${t.rank}. ${t.topic} - ${t.tweets} tweets`));
        console.log('\n(Trending requires Ads API access - showing cached data)');
      }
      break;
    }

    case 'tweet': {
      checkAuth();
      const text = positionalArgs(1).join(' ');
      if (!text) { console.error('Error: tweet text required.'); process.exit(1); }
      if (usingXquikBackend()) {
        checkAuth({ action: true });
        const body = buildXquikTweetBody(requireXquikAccount(), text);
        const res = await xquikRequest('POST', '/api/v1/x/tweets', undefined, body);
        printActionResult(res, 'Tweet action submitted through Hermes Tweet/Xquik');
        break;
      }
      console.log('⚠ Tweet posting requires OAuth 1.0a user context (not Bearer Token).');
      console.log(`Would post: "${text}"`);
      break;
    }

    case 'reply': {
      checkAuth();
      if (usingXquikBackend()) {
        checkAuth({ action: true });
        const id = extractTweetId(subarg);
        const text = positionalArgs(2).join(' ');
        if (!id || !text) { console.error('Error: provide a tweet ID and reply text'); process.exit(1); }
        const body = buildXquikTweetBody(requireXquikAccount(), text, {
          replyToTweetId: id,
        });
        const res = await xquikRequest('POST', '/api/v1/x/tweets', undefined, body);
        printActionResult(res, 'Reply action submitted through Hermes Tweet/Xquik');
        break;
      }
      console.log('⚠ Reply posting requires OAuth 1.0a user context (not Bearer Token).');
      break;
    }

    case 'quote': {
      checkAuth();
      if (usingXquikBackend()) {
        checkAuth({ action: true });
        const id = extractTweetId(subarg);
        const text = positionalArgs(2).join(' ');
        if (!id || !text) { console.error('Error: provide a tweet ID and quote text'); process.exit(1); }
        const body = buildXquikTweetBody(requireXquikAccount(), text, {
          quoteTweetId: id,
        });
        const res = await xquikRequest('POST', '/api/v1/x/tweets', undefined, body);
        printActionResult(res, 'Quote action submitted through Hermes Tweet/Xquik');
        break;
      }
      console.log('⚠ Quote tweet requires OAuth 1.0a user context (not Bearer Token).');
      break;
    }

    case 'like': case 'unlike': case 'retweet': case 'unretweet':
    case 'follow': case 'unfollow': {
      checkAuth();
      if (usingXquikBackend()) {
        checkAuth({ action: true });
        const id = command === 'follow' || command === 'unfollow' ? subarg?.replace(/^@/, '') : extractTweetId(subarg);
        if (!id) { console.error('Error: provide a tweet ID, tweet URL, or @handle'); process.exit(1); }
        const account = requireXquikAccount();
        const method = command.startsWith('un') ? 'DELETE' : 'POST';
        const path = command.includes('follow')
          ? `/api/v1/x/users/${encodeURIComponent(id)}/follow`
          : `/api/v1/x/tweets/${id}/${command.includes('retweet') ? 'retweet' : 'like'}`;
        const res = await xquikRequest(method, path, undefined, { account });
        printActionResult(res, `${command} action submitted through Hermes Tweet/Xquik`);
        break;
      }
      console.log(`⚠ ${command} requires OAuth 1.0a user context (not Bearer Token).`);
      break;
    }

    case 'bookmark': case 'unbookmark': {
      checkAuth();
      console.log(`⚠ ${command} requires OAuth user context. Hermes Tweet currently exposes bookmark reads, not bookmark write actions.`);
      break;
    }

    case 'home': case 'mentions': case 'likes':
    case 'followers': case 'following':
    case 'lists': case 'list-timeline': case 'list-add': case 'list-remove': {
      checkAuth();
      if (usingXquikBackend() && (command === 'followers' || command === 'following')) {
        const username = subarg?.replace(/^@/, '');
        if (!username) { console.error('Error: provide a @handle or username'); process.exit(1); }
        const res = await xquikRequest('GET', `/api/v1/x/users/${encodeURIComponent(username)}/${command}`, {
          pageSize: count,
          cursor: flags.cursor,
        });
        printUsers(res, `No ${command} found.`);
        break;
      }
      if (usingXquikBackend() && command === 'likes') {
        const username = subarg?.replace(/^@/, '');
        if (!username) { console.error('Error: provide a @handle or username'); process.exit(1); }
        const res = await xquikRequest('GET', `/api/v1/x/users/${encodeURIComponent(username)}/likes`, {
          cursor: flags.cursor,
        });
        printTweets(res, 'No liked tweets found.');
        break;
      }
      console.log(`⚠ ${command} requires OAuth 1.0a user context (not Bearer Token).`);
      break;
    }

    default: {
      console.log(`twclaw - Twitter/X CLI for OpenClaw

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
  --backend   Backend: twitter (default), hermes-tweet, or xquik
  --account   X account for Hermes Tweet write actions
  -n <count>  Number of results (default: 10)
`);
      break;
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildXquikHeaders,
  buildXquikTweetBody,
  buildXquikUrl,
  normalizeTweet,
  normalizeTweets,
  normalizeUser,
  normalizeUsers,
  resolveBackend,
};
