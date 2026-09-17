# Telegram-Bot — Production Build

A Deno/V8-based Telegram business management, communication, and automation
system, implementing the owner/users/groups model described in the system
overview: publishing, editable buttons, scheduling, destination management,
access control, and group-mention assistance.

## Stack

- **Runtime:** Deno (webhook server via `Deno.serve`, background jobs via `Deno.cron`)
- **Telegram framework:** [grammY](https://grammy.dev)
- **Storage:** Deno KV (built-in, zero external dependency; swap for Postgres/etc. by reimplementing `src/db.ts` if you outgrow it)
- **Hosting:** Deno Deploy (recommended) or any host that runs Deno with `--unstable-kv --unstable-cron`

## Project layout

```
telegram-bot/
├── main.ts                     # webhook server + cron entry point
├── deno.json                   # tasks + import map
├── .env.example                # required environment variables
├── scripts/set_webhook.ts      # one-time webhook registration
└── src/
    ├── config.ts                # env var loading
    ├── types.ts                 # domain types
    ├── db.ts                    # Deno KV persistence layer
    ├── bot.ts                   # command/message routing
    ├── middleware/auth.ts       # owner-only / approved-only gates
    └── features/
        ├── destinations.ts      # connect/list/remove channels & groups
        ├── publish.ts           # multi-destination publish + wizard
        ├── buttons.ts           # update a button's URL across old posts
        ├── scheduling.ts        # /schedule + cron-driven publication
        ├── access.ts            # request/approve/decline access
        ├── groupMention.ts      # respond only when @mentioned in groups
        └── assistance.ts        # simple FAQ-style business assistance
```

## Setup

1. **Create the bot** with [@BotFather](https://t.me/BotFather) and copy the token.
2. **Get your Telegram user id** from [@userinfobot](https://t.me/userinfobot) — this becomes `OWNER_ID`.
3. Copy `.env.example` to `.env` and fill in `BOT_TOKEN`, `OWNER_ID`, a random `WEBHOOK_SECRET`, and `PUBLIC_URL` (set after your first deploy).
4. Install the [Deno CLI](https://deno.com) if running locally.

## Local development (polling is simplest locally, but this build uses webhooks)

For local testing, the quickest path is a tunnel (e.g. `deno task dev` behind `ngrok http 8000`), setting `PUBLIC_URL` to the tunnel's HTTPS URL, then running:

```
deno task setwebhook
deno task dev
```

## Deploying to Deno Deploy

1. Push this project to a GitHub repo.
2. Create a new Deno Deploy project linked to the repo, entry point `main.ts`.
3. Add the environment variables from `.env.example` in the Deno Deploy dashboard.
4. Set `PUBLIC_URL` to your `*.deno.dev` URL, redeploy, then run `deno task setwebhook` locally (pointing at the same env vars) to register the webhook.

## Using the bot

**Owner commands** (only work for the Telegram account matching `OWNER_ID`):

| Command | Purpose |
|---|---|
| `/adddestination <label>` | Run inside a channel/group to connect it |
| `/listdestinations` | List connected destinations and their ids |
| `/removedestination <id>` | Disconnect a destination |
| `/publish` | Start the guided publish flow (text → buttons → destinations) |
| `/schedule <when> \| <dest ids> \| <text>` | Schedule a post, e.g. `/schedule 2026-09-10T10:00 \| main-channel,promo \| Big sale tomorrow!` |
| `/changebutton <buttonId> <newUrl>` | Update a button's destination across every post that used it |
| `/requests` | Review and approve/decline pending access requests |

**User commands:**

| Command | Purpose |
|---|---|
| `/start` | Greeting and basic guidance |
| `/requestaccess` | Ask the owner for approval to use gated features |
| plain text | Answered by the FAQ-style business assistance handler |

**Groups:** the bot only responds when explicitly mentioned, e.g. `@YourBot price of Product A?`.

## Extending

- **Business assistance:** `src/features/assistance.ts` has a small keyword-matched FAQ table — swap the `answerBusinessQuestion` function for an LLM call or CMS lookup as needed.
- **Gated features for approved users:** wrap any handler with the `approvedOnly` middleware from `src/middleware/auth.ts`.
- **Storage:** all persistence goes through `src/db.ts`; replace its internals to move off Deno KV without touching feature code.

## Data retention

Following the privacy principle in the system overview, only functionally
necessary data is stored permanently (destinations, published posts + button
index, schedules, access decisions). In-progress conversation state (the
publish wizard) is stored with a 30-minute TTL and expires automatically if
abandoned.
