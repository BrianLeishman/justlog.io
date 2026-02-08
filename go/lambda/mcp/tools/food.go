package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/BrianLeishman/justlog.io/go/dynamo"
	mcpauth "github.com/BrianLeishman/justlog.io/go/lambda/mcp/auth"
	"github.com/mark3labs/mcp-go/mcp"
)

func init() {
	Register(logFood)
	Register(getFood)
}

func logFood(s *Spec) {
	s.Define("log_food",
		mcp.WithDescription("Log a food entry with nutritional info. Use this when the user tells you what they ate."),
		mcp.WithString("description", mcp.Description("What was eaten, e.g. '2 eggs and toast'"), mcp.Required()),
		mcp.WithNumber("calories", mcp.Description("Total calories")),
		mcp.WithNumber("protein", mcp.Description("Protein in grams")),
		mcp.WithNumber("carbs", mcp.Description("Carbohydrates in grams")),
		mcp.WithNumber("fat", mcp.Description("Fat in grams")),
		mcp.WithNumber("fiber", mcp.Description("Fiber in grams")),
		mcp.WithNumber("caffeine", mcp.Description("Caffeine in milligrams")),
		mcp.WithNumber("cholesterol", mcp.Description("Cholesterol in milligrams")),
		mcp.WithString("notes", mcp.Description("Optional notes")),
		mcp.WithString("timestamp", mcp.Description("ISO 8601 timestamp; defaults to now"), mcp.Required()),
	)

	s.Handler(func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		uid, err := mcpauth.UserID(ctx)
		if err != nil {
			return nil, err
		}

		ts, err := parseTimestamp(req.GetString("timestamp", ""))
		if err != nil {
			return nil, err
		}

		entry := dynamo.Entry{
			UID:         uid,
			SK:          dynamo.MakeSK("food"),
			Type:        "food",
			Description: req.GetString("description", ""),
			Calories:    req.GetFloat("calories", 0),
			Protein:     req.GetFloat("protein", 0),
			Carbs:       req.GetFloat("carbs", 0),
			Fat:         req.GetFloat("fat", 0),
			Fiber:       req.GetFloat("fiber", 0),
			Caffeine:    req.GetFloat("caffeine", 0),
			Cholesterol: req.GetFloat("cholesterol", 0),
			Notes:       req.GetString("notes", ""),
			CreatedAt:   ts.Format(time.RFC3339),
		}

		if err := dynamo.PutEntry(ctx, entry); err != nil {
			return nil, fmt.Errorf("save food entry: %w", err)
		}

		return mcp.NewToolResultText(fmt.Sprintf("Logged food: %s (%0.f cal)", entry.Description, entry.Calories)), nil
	})
}

func getFood(s *Spec) {
	s.Define("get_food",
		mcp.WithDescription("Get food entries for a date range. Defaults to today."),
		mcp.WithString("from", mcp.Description("Start date, ISO 8601 (e.g. 2026-02-05)")),
		mcp.WithString("to", mcp.Description("End date, ISO 8601 (e.g. 2026-02-05)")),
	)

	s.Handler(func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		uid, err := mcpauth.UserID(ctx)
		if err != nil {
			return nil, err
		}

		from, to := todayRange()
		if v := req.GetString("from", ""); v != "" {
			t, err := time.Parse("2006-01-02", v)
			if err != nil {
				return nil, fmt.Errorf("invalid from date: %w", err)
			}
			from = t.UTC()
		}
		if v := req.GetString("to", ""); v != "" {
			t, err := time.Parse("2006-01-02", v)
			if err != nil {
				return nil, fmt.Errorf("invalid to date: %w", err)
			}
			to = t.AddDate(0, 0, 1).UTC()
		}

		entries, err := dynamo.GetEntries(ctx, uid, "food", from, to)
		if err != nil {
			return nil, err
		}

		if len(entries) == 0 {
			return mcp.NewToolResultText("No food entries found for that date range."), nil
		}

		b, _ := json.MarshalIndent(entries, "", "  ")
		return mcp.NewToolResultText(string(b)), nil
	})
}

func parseTimestamp(v string) (time.Time, error) {
	if v == "" {
		return time.Now().UTC(), nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid timestamp: %w", err)
	}
	return t.UTC(), nil
}

func todayRange() (time.Time, time.Time) {
	now := time.Now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, 1)
	return start, end
}
