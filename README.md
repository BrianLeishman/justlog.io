# JustLog

A calorie, macro, and weight tracking service designed to be used through AI assistants. There is no app UI for data entry. You tell your AI what you ate, what exercise you did, or what you weigh, and it handles the rest.

The core idea: the MCP server is the product. Claude, ChatGPT, or any MCP-compatible client acts as the interface. The AI estimates calories and macros from natural language, and JustLog stores the numbers.

## How It Works

Connect the JustLog MCP server to your AI assistant. Then just talk to it normally:

- "I had a Publix three-tender meal with the roll, wedges and onion rings for the sides"
- "Did 30 minutes on the treadmill, 12% incline at 2.5 mph"
- "Weighed in at 236 this morning"

The AI figures out the nutritional breakdown, calorie burn, or weight entry and logs it through the MCP server. When you want to see your data, just ask — daily totals, weekly averages, trends, charts, whatever you need.

## What Gets Tracked

**Food** — calories, protein, carbs, fat, fiber, and a text description of what you ate.

**Exercise** — estimated calories burned and a text description of the activity.

**Weight** — body weight in pounds.

That's it. No barcode scanning, no food database searches, no manual data entry forms. The AI does the estimation work, the server stores numbers.

## Stack

- AWS Lambda (MCP server and REST API)
- DynamoDB (data storage)
- AWS Cognito (authentication, supports Google login)
- S3 + CloudFront + Hugo (marketing site / docs)

## MCP Server

The server implements the MCP 2025-06-18 specification using Streamable HTTP transport. It exposes a small set of tools for logging and querying data. See `agents.md` for detailed guidance on how AI agents should interact with the server, including how to estimate macros, handle ambiguous food descriptions, and calculate exercise calories.

## Authentication

Users create an account through AWS Cognito. Google sign-in is supported. The MCP server requires a valid bearer token for all operations. Each user's data is isolated — you can only read and write your own entries.

## API

In addition to the MCP interface, a standard REST API is available for building dashboards, integrations, or export tools. The API uses the same Cognito authentication.

## Self-Hosting

JustLog is open source. If you want to run your own instance, you'll need an AWS account. Infrastructure is defined as code and designed to operate within free tier or near-free tier costs for personal use.

## License

MIT