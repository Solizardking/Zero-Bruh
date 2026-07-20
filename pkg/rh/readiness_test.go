package rh

import (
	"strings"
	"testing"

	"github.com/8bitlabs/clawdbot/pkg/config"
)

func TestAssessReadiness(t *testing.T) {
	empty := AssessReadiness(config.RobinhoodConfig{ChainID: 4663})
	if empty.Ready {
		t.Fatal("empty should not be ready")
	}
	if !containsAll(empty.Missing, "BLOCKSCOUT_API_KEY", "RH_RPC_URL") {
		t.Fatalf("missing = %#v", empty.Missing)
	}
	if empty.ResolvedRPC != PublicRPCURL {
		t.Fatalf("resolved = %s", empty.ResolvedRPC)
	}
	if empty.ChainID != 4663 {
		t.Fatalf("chain = %d", empty.ChainID)
	}

	full := AssessReadiness(config.RobinhoodConfig{
		ChainID:          4663,
		BlockscoutAPIKey: "proapi_x",
		RPCURL:           "https://rpc.private/rh",
	})
	if !full.Ready {
		t.Fatalf("full should be ready: %s", full.Message)
	}
	if full.UsingPublicRPCRead {
		t.Fatal("should not use public when custom set")
	}
	if err := RequireReadiness(config.RobinhoodConfig{}); err == "" {
		t.Fatal("RequireReadiness should error when empty")
	}
	if err := RequireReadiness(full.asConfig()); err != "" {
		t.Fatalf("unexpected require error: %s", err)
	}
}

// helper: rebuild config from readiness inputs for Require on full set
func (r Readiness) asConfig() config.RobinhoodConfig {
	cfg := config.RobinhoodConfig{ChainID: r.ChainID}
	if r.BlockscoutConfigured {
		cfg.BlockscoutAPIKey = "set"
	}
	if r.RHRpcConfigured {
		cfg.RPCURL = r.ResolvedRPC
	}
	return cfg
}

func containsAll(have []string, want ...string) bool {
	set := map[string]bool{}
	for _, h := range have {
		set[h] = true
	}
	for _, w := range want {
		if !set[w] {
			return false
		}
	}
	return true
}

func TestRequireReadinessMessage(t *testing.T) {
	msg := RequireReadiness(config.RobinhoodConfig{})
	if !strings.Contains(msg, "BLOCKSCOUT_API_KEY") || !strings.Contains(msg, "RH_RPC_URL") {
		t.Fatalf("msg = %s", msg)
	}
}
