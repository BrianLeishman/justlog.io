package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	mcpauth "github.com/BrianLeishman/justlog.io/go/lambda/mcp/auth"
	"github.com/BrianLeishman/justlog.io/go/lambda/mcp/tools"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func main() {
	isLambda := os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != ""

	mcpServer := server.NewMCPServer(
		"JustLog",
		"1.0.0",
		server.WithInstructions("JustLog helps users track calories, macros, exercise, and weight. Use the provided tools to log and retrieve entries."),
		server.WithRecovery(),
	)

	for _, t := range tools.All() {
		mcpServer.AddTool(t.Tool, wrapTool(t.Handler))
	}

	// stdio mode for local MCP clients (e.g. Claude Code)
	if os.Getenv("MCP_STDIO") != "" {
		ctx := context.Background()
		if devUser := os.Getenv("DEV_USER"); devUser != "" {
			ctx = mcpauth.NewContext(ctx, mcpauth.User{Sub: devUser, Email: devUser})
		}
		stdio := server.NewStdioServer(mcpServer)
		if err := stdio.Listen(ctx, os.Stdin, os.Stdout); err != nil {
			log.Fatal(err)
		}
		return
	}

	if isLambda {
		// In Lambda: use a plain HTTP handler that processes JSON-RPC directly
		mux := http.NewServeMux()
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			log.Printf("request: %s %s", r.Method, r.URL.Path)

			// Only handle POST for MCP JSON-RPC
			if r.Method != http.MethodPost {
				// Return 404 for any non-POST (OAuth discovery, GET, etc.)
				w.WriteHeader(http.StatusNotFound)
				return
			}

			ctx := r.Context()
			ctx = authenticateRequest(ctx, r)

			body, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, "bad request", http.StatusBadRequest)
				return
			}

			log.Printf("request body: %s", body)

			resp := mcpServer.HandleMessage(ctx, body)
			w.Header().Set("Content-Type", "application/json")
			out, _ := json.Marshal(resp)
			log.Printf("response: %s", out)
			w.Write(out)
		})

		adapter := httpadapter.New(mux)
		lambda.Start(adapter.ProxyWithContext)
	} else {
		// Local: use StreamableHTTPServer for full MCP protocol support
		httpServer := server.NewStreamableHTTPServer(
			mcpServer,
			server.WithStateLess(true),
			server.WithHTTPContextFunc(authenticateRequest),
		)

		addr := ":8088"
		fmt.Printf("MCP server listening on %s\n", addr)
		if err := httpServer.Start(addr); err != nil {
			log.Fatal(err)
		}
	}
}

func authenticateRequest(ctx context.Context, r *http.Request) context.Context {
	if devUser := os.Getenv("DEV_USER"); devUser != "" {
		return mcpauth.NewContext(ctx, mcpauth.User{Sub: devUser, Email: devUser})
	}

	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if token == "" {
		return ctx
	}
	u, err := mcpauth.FromToken(ctx, token)
	if err != nil {
		log.Printf("auth error: %v", err)
		return ctx
	}
	return mcpauth.NewContext(ctx, u)
}

func wrapTool(fn server.ToolHandlerFunc) server.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (result *mcp.CallToolResult, err error) {
		defer func() {
			if r := recover(); r != nil {
				result = mcp.NewToolResultError(fmt.Sprintf("internal error: %v", r))
				err = nil
			}
		}()

		result, err = fn(ctx, req)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return result, nil
	}
}
