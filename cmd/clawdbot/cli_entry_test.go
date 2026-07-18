package main

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/8bitlabs/clawdbot/pkg/config"
)

// TestNewClawdBotCommand_version drives the real cobra entry path used by main():
// NewClawdBotCommand → Execute("version") → config.FormatVersion output.
func TestNewClawdBotCommand_version(t *testing.T) {
	origV, origC, origB := config.Version, config.GitCommit, config.BuildTime
	t.Cleanup(func() {
		config.Version, config.GitCommit, config.BuildTime = origV, origC, origB
	})
	config.Version = "cli-test-0.0.1"
	config.GitCommit = "deadbeef"
	config.BuildTime = "2026-07-15T12:00:00Z"

	cmd := NewClawdBotCommand()
	if cmd == nil {
		t.Fatal("NewClawdBotCommand returned nil")
	}
	if cmd.Use != "clawdbot" {
		t.Fatalf("root Use = %q, want clawdbot", cmd.Use)
	}

	// Capture stdout from the version command Run path (fmt.Printf in NewVersionCommand).
	stdout, restore := captureStdout(t)

	cmd.SetArgs([]string{"version"})
	if err := cmd.Execute(); err != nil {
		restore()
		t.Fatalf("Execute(version): %v", err)
	}
	// Must restore (close pipe) before reading so the copy goroutine finishes.
	restore()

	out := stdout.String()
	if !strings.Contains(out, "clawdbot") {
		t.Fatalf("version output missing clawdbot identity:\n%s", out)
	}
	if !strings.Contains(out, "cli-test-0.0.1") {
		t.Fatalf("version output missing version string:\n%s", out)
	}
	if !strings.Contains(out, "deadbeef") {
		t.Fatalf("version output missing git commit:\n%s", out)
	}
	if !strings.Contains(out, "2026-07-15T12:00:00Z") {
		t.Fatalf("version output missing build time:\n%s", out)
	}
	if !strings.Contains(out, "go:") {
		t.Fatalf("version output missing go: line:\n%s", out)
	}
}

// TestNewClawdBotCommand_help identifies clawdbot on the documented root help path.
func TestNewClawdBotCommand_help(t *testing.T) {
	cmd := NewClawdBotCommand()
	buf := new(bytes.Buffer)
	cmd.SetOut(buf)
	cmd.SetErr(buf)
	cmd.SetArgs([]string{"--help"})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("Execute(--help): %v", err)
	}
	out := buf.String()
	// Long description + command list should identify the product.
	if !strings.Contains(out, "Zero Clawd") && !strings.Contains(out, "clawdbot") {
		t.Fatalf("help output missing clawdbot/Zero Clawd identity:\n%s", out)
	}
	if !strings.Contains(out, "version") {
		t.Fatalf("help output missing version command:\n%s", out)
	}
}

func captureStdout(t *testing.T) (*bytes.Buffer, func()) {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	old := os.Stdout
	os.Stdout = w
	buf := new(bytes.Buffer)
	done := make(chan struct{})
	go func() {
		_, _ = io.Copy(buf, r)
		close(done)
	}()
	restore := func() {
		_ = w.Close()
		<-done
		os.Stdout = old
		_ = r.Close()
	}
	return buf, restore
}
