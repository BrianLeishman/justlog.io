package tools

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type Spec struct {
	tool    mcp.Tool
	handler server.ToolHandlerFunc
}

func (s *Spec) Define(name string, opts ...mcp.ToolOption) {
	s.tool = mcp.NewTool(name, opts...)
}

func (s *Spec) Handler(fn func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error)) {
	s.handler = fn
}

var registry []Spec

func Register(fn func(*Spec)) {
	var s Spec
	fn(&s)
	registry = append(registry, s)
}

func All() []server.ServerTool {
	out := make([]server.ServerTool, len(registry))
	for i, s := range registry {
		out[i] = server.ServerTool{Tool: s.tool, Handler: s.handler}
	}
	return out
}
