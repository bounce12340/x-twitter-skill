const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  buildXquikHeaders,
  buildXquikTweetBody,
  buildXquikUrl,
  normalizeTweet,
  normalizeTweets,
  normalizeUser,
  normalizeUsers,
  resolveBackend,
} = require('../bin/twclaw.js');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'twclaw.js');

test('maps Hermes Tweet backend aliases to the Xquik adapter', () => {
  assert.equal(resolveBackend('hermes-tweet'), 'xquik');
  assert.equal(resolveBackend('xquik'), 'xquik');
  assert.equal(resolveBackend('twitter'), 'twitter');
});

test('builds Xquik URLs with encoded query parameters', () => {
  const url = buildXquikUrl('/api/v1/x/tweets/search', {
    q: 'AI agents from:openai',
    limit: 5,
    cursor: undefined,
  }, 'https://example.test/');

  assert.equal(
    url.toString(),
    'https://example.test/api/v1/x/tweets/search?q=AI+agents+from%3Aopenai&limit=5',
  );
});

test('uses the Xquik API key header for xq-prefixed keys', () => {
  assert.deepEqual(buildXquikHeaders('xq_test', true), {
    'User-Agent': 'twclaw/1.0',
    'x-api-key': 'xq_test',
    'content-type': 'application/json',
  });
});

test('uses bearer authorization for non-xq keys', () => {
  assert.deepEqual(buildXquikHeaders('token', false), {
    'User-Agent': 'twclaw/1.0',
    authorization: 'Bearer token',
  });
});

test('builds reply and quote payloads using the public API field names', () => {
  assert.deepEqual(
    buildXquikTweetBody('@agent', 'Reply text', {
      replyToTweetId: '123',
    }),
    {
      account: '@agent',
      text: 'Reply text',
      reply_to_tweet_id: '123',
    },
  );
  assert.deepEqual(
    buildXquikTweetBody('@agent', 'Quote text', {
      quoteTweetId: '456',
    }),
    {
      account: '@agent',
      text: 'Quote text',
      attachment_url: 'https://x.com/i/status/456',
    },
  );
});

test('does not reveal any bearer-token prefix during auth checks', () => {
  const token = 'sensitive-token-value';
  const result = spawnSync(process.execPath, [CLI_PATH, 'auth-check'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TWITTER_BEARER_TOKEN: token,
    },
  });

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /sensitive|token-value/);
});

test('normalizes nested Hermes Tweet tweet payloads', () => {
  const tweet = normalizeTweet({
    data: {
      tweetId: '123',
      fullText: 'Hermes Tweet can read this thread.',
      author: { name: 'Hermes', username: 'hermes_agent' },
      likeCount: '7',
      retweetCount: 3,
      replyCount: 2,
      bookmarkCount: 1,
      createdAt: '2026-05-23T10:00:00Z',
    },
  });

  assert.deepEqual(tweet, {
    id: '123',
    author: 'Hermes',
    handle: '@hermes_agent',
    text: 'Hermes Tweet can read this thread.',
    created_at: '2026-05-23T10:00:00Z',
    likes: 7,
    retweets: 3,
    replies: 2,
    bookmarks: 1,
  });
});

test('normalizes tweet arrays from common Xquik response shapes', () => {
  const tweets = normalizeTweets({
    data: {
      tweets: [
        { id: '1', text: 'first', user: { username: 'one' } },
        { id: '2', text: 'second', user: { username: 'two' } },
      ],
    },
  });

  assert.equal(tweets.length, 2);
  assert.equal(tweets[0].handle, '@one');
  assert.equal(tweets[1].text, 'second');
});

test('normalizes user arrays from follower and following payloads', () => {
  const users = normalizeUsers({
    followers: [
      {
        userId: '42',
        name: 'Ada',
        username: '@ada',
        followersCount: 100,
        followingCount: 9,
      },
    ],
  });

  assert.deepEqual(users, [
    {
      id: '42',
      name: 'Ada',
      username: 'ada',
      description: '',
      verified: false,
      followers: 100,
      following: 9,
    },
  ]);
});

test('normalizes a direct user payload', () => {
  const user = normalizeUser({
    data: {
      id: '7',
      screen_name: 'agent',
      description: 'X automation',
      public_metrics: { followers_count: 12, following_count: 5 },
      verified: true,
    },
  });

  assert.equal(user.id, '7');
  assert.equal(user.username, 'agent');
  assert.equal(user.followers, 12);
  assert.equal(user.verified, true);
});
