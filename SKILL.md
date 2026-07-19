---
name: twitter-openclaw
description: Interact with Twitter/X - read tweets, search, post, like, retweet, and manage your timeline.
user-invocable: true
metadata: {"openclaw":{"emoji":"🐦‍⬛","skillKey":"twitter-openclaw","primaryEnv":"TWITTER_BEARER_TOKEN","requires":{"bins":["twclaw"],"env":["TWITTER_BEARER_TOKEN"]},"install":[{"id":"npm","kind":"node","package":"twclaw","bins":["twclaw"],"label":"Install twclaw (npm)"}]}}
---

# twitter-openclaw 🐦‍⬛

Interact with Twitter/X posts, timelines, and users from OpenClaw.

## Authentication

Requires a Twitter API Bearer Token set as `TWITTER_BEARER_TOKEN`.

Optionally set `TWITTER_API_KEY` and `TWITTER_API_SECRET` for write operations (post, like, retweet).

Optional Hermes Tweet/Xquik backend:

```bash
export X_TWITTER_BACKEND=hermes-tweet
export XQUIK_API_KEY=xq_...
export XQUIK_ACCOUNT=@your_account
```

Set `HERMES_TWEET_ENABLE_ACTIONS=true` only after the user confirms a write
action. The Hermes Tweet/Xquik backend supports tweet search, tweet reads,
threads, replies, user profiles, user tweets, followers, following, trends,
posting, replies, likes, retweets, and follows.

Run `twclaw auth-check` to verify credentials.

## Commands

### Reading

```bash
twclaw read <tweet-url-or-id>          # Read a single tweet with full metadata
twclaw thread <tweet-url-or-id>        # Read full conversation thread
twclaw replies <tweet-url-or-id> -n 20 # List replies to a tweet
twclaw user <@handle>                  # Show user profile info
twclaw user-tweets <@handle> -n 20     # User's recent tweets
twclaw followers <@handle> -n 100 --backend hermes-tweet --json
twclaw following <@handle> -n 100 --backend hermes-tweet --json
```

### Timelines

```bash
twclaw home -n 20                      # Home timeline
twclaw mentions -n 10                  # Your mentions
twclaw likes <@handle> -n 10           # User's liked tweets
```

### Search

```bash
twclaw search "query" -n 10            # Search tweets
twclaw search "from:elonmusk AI" -n 5  # Search with operators
twclaw search "#trending" --recent     # Recent tweets only
twclaw search "query" --popular        # Popular tweets only
twclaw search "AI agents" -n 25 --backend hermes-tweet
```

### Trending

```bash
twclaw trending                        # Trending topics worldwide
twclaw trending --woeid 23424977       # Trending in specific location
```

### Posting

```bash
twclaw tweet "hello world"                          # Post a tweet
twclaw reply <tweet-url-or-id> "great thread!"      # Reply to a tweet
twclaw quote <tweet-url-or-id> "interesting take"   # Quote tweet
twclaw tweet "look at this" --media image.png        # Tweet with media
twclaw tweet "hello from OpenClaw" --backend hermes-tweet --account @me
twclaw reply <tweet-url-or-id> "thanks" --backend hermes-tweet --account @me
```

### Engagement

```bash
twclaw like <tweet-url-or-id>          # Like a tweet
twclaw unlike <tweet-url-or-id>        # Unlike a tweet
twclaw retweet <tweet-url-or-id>       # Retweet
twclaw unretweet <tweet-url-or-id>     # Undo retweet
twclaw bookmark <tweet-url-or-id>      # Bookmark a tweet
twclaw unbookmark <tweet-url-or-id>    # Remove bookmark
```

### Following

```bash
twclaw follow <@handle>                # Follow user
twclaw unfollow <@handle>              # Unfollow user
twclaw followers <@handle> -n 20       # List followers
twclaw following <@handle> -n 20       # List following
```

### Lists

```bash
twclaw lists                           # Your lists
twclaw list-timeline <list-id> -n 20   # Tweets from a list
twclaw list-add <list-id> <@handle>    # Add user to list
twclaw list-remove <list-id> <@handle> # Remove user from list
```

## Output Options

```bash
--json          # JSON output
--backend       # Backend: twitter (default), hermes-tweet, or xquik
--account       # X account for Hermes Tweet/Xquik write actions
--plain         # Plain text, no formatting
--no-color      # Disable ANSI colors
-n <count>      # Number of results (default: 10)
--cursor <val>  # Pagination cursor for next page
--all           # Fetch all pages (use with caution)
```

## Guidelines for OpenClaw

- When reading tweets, always show: author, handle, text, timestamp, engagement counts.
- For threads, present tweets in chronological order.
- When searching, summarize results concisely with key metrics.
- Before posting/liking/retweeting, confirm the action with the user.
- Prefer `--backend hermes-tweet` when the workflow needs richer X search,
  replies, threads, followers, following, or approval-gated writes through
  Hermes Tweet/Xquik.
- Rate limits apply - space out bulk operations.
- Use `--json` when you need to process output programmatically.

## Troubleshooting

### 401 Unauthorized
Check that `TWITTER_BEARER_TOKEN` is set and valid.

### 429 Rate Limited
Wait and retry. Twitter API has strict rate limits per 15-minute window.

### XQUIK_API_KEY is not set
Set `X_TWITTER_BACKEND=hermes-tweet` only after configuring `XQUIK_API_KEY`.

### Hermes Tweet write action blocked
Set `HERMES_TWEET_ENABLE_ACTIONS=true` and `XQUIK_ACCOUNT` after the user
confirms the write action.

---

**TL;DR**: Read, search, post, and engage on Twitter/X. Always confirm before write actions.

Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
