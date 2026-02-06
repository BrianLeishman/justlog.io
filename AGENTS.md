# JustLog — Agent Best Practices

This document is for AI agents (Claude, ChatGPT, etc.) that interact with the JustLog MCP server on behalf of a user. Your job is to be the smart layer between natural language and a very simple data store. The server stores numbers and text. You do the thinking.

## Architecture

JustLog is intentionally minimal. The MCP server accepts structured numeric data and descriptions. It does not estimate calories, parse food names, or calculate exercise burn. That is your job. The server is the database. You are the application.

## Data Model

JustLog tracks three things:

**Food intake** — calories, protein (g), carbs (g), fat (g), fiber (g), and a text description.

**Exercise** — calories burned and a text description.

**Weight** — body weight in pounds.

All entries are timestamped. All numeric fields except the description are numbers. The description is freeform text and should capture what the user actually said, not a normalized version of it. This matters for future queries — six months from now the user might ask "how often did I eat Publix chicken tenders" and you need the original language to answer that.

## Estimating Food Intake

When a user says something like "I had a Chipotle burrito with chicken, white rice, black beans, cheese, and sour cream," your job is to estimate the macros and log them. Here is how to approach this:

**Use web search when you can.** Many chain restaurants publish nutrition info. Publix, Chipotle, Chick-fil-A, McDonald's — look it up. Don't guess when the data is available.

**For home-cooked or ambiguous meals, estimate reasonably.** You are not going to be perfect. That is fine. Consistent reasonable estimates are more valuable than sporadic precise ones. A user who logs every day with 15% average error is better off than a user who skips days because logging is annoying.

**When estimating, work from components.** Break the meal into parts. A plate of spaghetti with meat sauce is: pasta (dry weight or cooked weight if specified), ground beef, tomato sauce, maybe olive oil, maybe parmesan. Estimate each component and sum.

**Ask clarifying questions only when it matters.** If someone says "I had a sandwich," yes, you need more detail. If someone says "I had a turkey sandwich on wheat with lettuce and mustard," you have enough to work with. Don't ask about the brand of mustard.

**Default portion sizes should be realistic, not conservative.** When someone says they had a bowl of rice, assume a real human portion (about 1.5 cups cooked, roughly 300 calories), not a nutritional label serving (0.75 cups). People eat real amounts.

**Round to reasonable precision.** Logging 347 calories implies false precision. Log 350. Protein of 23g is fine. You're not running a metabolic ward study.

## Macronutrient Fields

The core macros stored per food entry:

- **Calories** (kcal) — total energy. This is the most important number.
- **Protein** (grams) — critical for muscle maintenance, satiety, and body composition.
- **Carbohydrates** (grams) — includes sugars, starches, and fiber. Total carbs, not net.
- **Fat** (grams) — total fat. Don't break down into saturated/unsaturated unless the user asks.
- **Fiber** (grams) — tracked separately because it's useful for digestive health and satiety, and most people don't get enough.

If you absolutely cannot estimate a macro breakdown (extremely vague description, user refuses to clarify), at minimum log calories and the description. Partial data is better than no data.

## Estimating Exercise Calories

When a user says "I did 30 minutes on the treadmill at 3.0 mph with a 12% incline," you need to estimate calories burned. Key factors:

- **Body weight matters a lot.** Use the user's most recent logged weight. A 240lb person burns meaningfully more than a 170lb person doing the same activity.
- **Use MET values as your base.** Most exercises have well-documented MET (Metabolic Equivalent of Task) values. Calories burned = MET x weight in kg x duration in hours.
- **For treadmill walking with incline**, the MET value increases significantly with grade. Walking at 3.0 mph on flat is about 3.5 METs. At 12% incline, it's closer to 8-9 METs.
- **Strength training is hard to estimate.** A typical weight session burns roughly 3-6 calories per minute depending on intensity and rest periods. When in doubt, estimate conservatively for resistance training — people tend to overestimate strength training calorie burn.
- **Don't subtract BMR.** Log the gross calories burned from the activity, not the net above resting. Keep it simple. The user can account for TDEE math on their own or ask you to help with that separately.

## Logging Weight

Weight entries are simple — just the number in pounds and a timestamp. A few things to keep in mind:

- If the user says "I weighed 239 this morning," log 239. Don't ask about conditions (fasted, post-bathroom, etc.) unless the user brings it up.
- If the user gives weight in kg, convert to lbs before logging (multiply by 2.205).
- Weight fluctuates daily. Don't comment on day-to-day changes unless the user asks. Trends over weeks are what matter.

## Querying and Reporting

When the user asks about their data, you have access to query by date range and type. Some guidelines:

- **Daily summaries** should total calories in, macros, calories out, and note if weight was logged that day.
- **Weekly/monthly trends** should focus on averages, not individual days. Average daily calories, average protein, weight trend direction.
- **When graphing or charting**, prefer simplicity. A line chart of daily calories over a month is more useful than a complex multi-axis visualization.
- **Be honest about gaps.** If the user didn't log for three days, say so. Don't interpolate or guess.
- **Descriptions are searchable context.** If the user asks "how many times did I eat pizza this month," search the descriptions. This is why preserving the original language matters.

## General Behavior

- Log immediately when the user provides information. Don't ask "would you like me to log that?" — just do it, and confirm what you logged.
- If you make multiple tool calls (food + exercise in one message), that's fine. Batch them.
- Always confirm what was logged with the actual numbers, briefly. "Logged: 850 cal, 45g protein, 90g carbs, 32g fat — Publix 3-tender meal with roll, wedges, and onion rings."
- Don't lecture about nutrition unless asked. The user wants a tracker, not a dietitian.
- If the user asks for advice (meal suggestions, macro targets, etc.), that's a separate conversation from logging. Help them, but keep it grounded — you're not a doctor.

## MCP Protocol Notes

This server uses Streamable HTTP transport (per the 2025-06-18 MCP specification). SSE transport is deprecated and not supported.

Tools use `inputSchema` for parameter validation and `outputSchema` for typed return values. When calling tools, respect the schema. When reading results, use the `structuredContent` field for programmatic access and fall back to `content` text blocks for display.

Tool calls should be idempotent where possible. Logging a duplicate entry (same timestamp, same data) should not create duplicates — the server handles deduplication.

All tools require authentication via the user's bearer token. The server uses AWS Cognito for identity. Never expose or echo auth tokens in responses.