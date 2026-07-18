package keyvault

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadParsesEnvLocalAndHidesControlKeys(t *testing.T) {
	t.Setenv(EnvVaultEnabled, "")
	t.Setenv(EnvVaultAllowedIPs, "")
	t.Setenv(EnvVaultToken, "")
	t.Setenv(EnvKeysToken, "")

	path := filepath.Join(t.TempDir(), ".env.local")
	writeFile(t, path, `
# comment
CLAWDBOT_VAULT_ENABLED=1
CLAWDBOT_VAULT_ALLOWED_IPS=203.0.113.7,10.0.0.0/8
CLAWDBOT_VAULT_TOKEN="vault-token"
HELIUS_API_KEY=helius-secret
QUOTED='quoted value'
BAD-NAME=ignored
`)

	vault, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if !vault.Enabled {
		t.Fatal("vault should be enabled from env file")
	}
	if !vault.ClientAllowed("203.0.113.7") || !vault.ClientAllowed("10.4.5.6") {
		t.Fatalf("allowlist not applied: %#v", vault.AllowedIPs)
	}
	if vault.ClientAllowed("198.51.100.9") {
		t.Fatal("unexpected IP allowed")
	}
	if got := vault.Token(); got != "vault-token" {
		t.Fatalf("Token() = %q", got)
	}
	if got, ok := vault.Get("HELIUS_API_KEY"); !ok || got != "helius-secret" {
		t.Fatalf("Get(HELIUS_API_KEY) = %q/%v", got, ok)
	}
	if _, ok := vault.Get(EnvVaultToken); ok {
		t.Fatal("control token should not be readable as a vault key")
	}
	keys := strings.Join(vault.Keys(), ",")
	if strings.Contains(keys, "CLAWDBOT_VAULT_TOKEN") || !strings.Contains(keys, "HELIUS_API_KEY") {
		t.Fatalf("unexpected key list: %s", keys)
	}
}

func TestExportShellQuotesValues(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env.local")
	writeFile(t, path, "A=one\nB='two words'\nC=\"has ' quote\"\n")
	vault, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	out := vault.Export([]string{"A", "B", "C", "MISSING"})
	for _, want := range []string{
		"export A='one'",
		"export B='two words'",
		"export C='has '\"'\"' quote'",
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("export output missing %q in:\n%s", want, out)
		}
	}
}

func TestDefaultsToLoopbackOnlyAndDisabled(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env.local")
	writeFile(t, path, "API_KEY=value\n")
	vault, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if vault.Enabled {
		t.Fatal("vault should default disabled")
	}
	if !vault.ClientAllowed("127.0.0.1") || !vault.ClientAllowed("::1") {
		t.Fatalf("loopback should be allowed by default: %#v", vault.AllowedIPs)
	}
	if vault.ClientAllowed("203.0.113.7") {
		t.Fatal("public IP should not be allowed by default")
	}
}

func TestUpsertEnvFile_allowlistAndPresence(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env.local")
	writeFile(t, path, "HELIUS_API_KEY=old\n# keep me\nOTHER=1\n")

	// Reject unknown keys
	if _, err := UpsertEnvFile(path, map[string]string{"NOT_A_REAL_KEY": "x"}); err == nil {
		t.Fatal("expected reject of unknown key")
	}

	written, err := UpsertEnvFile(path, map[string]string{
		"HELIUS_API_KEY":     "new-helius",
		"XAI_API_KEY":        "xai-secret",
		"OPENROUTER_API_KEY": "", // clear / skip create
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(written) == 0 {
		t.Fatal("expected written keys")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	body := string(data)
	if !strings.Contains(body, "HELIUS_API_KEY=new-helius") {
		t.Fatalf("update missing:\n%s", body)
	}
	if !strings.Contains(body, "XAI_API_KEY=xai-secret") {
		t.Fatalf("append missing:\n%s", body)
	}
	if !strings.Contains(body, "# keep me") {
		t.Fatalf("comment lost:\n%s", body)
	}
	if strings.Contains(body, "OPENROUTER_API_KEY") {
		t.Fatalf("empty key should not create line:\n%s", body)
	}
	// Process env applied
	if os.Getenv("HELIUS_API_KEY") != "new-helius" {
		t.Fatalf("env not applied: %q", os.Getenv("HELIUS_API_KEY"))
	}

	presence, err := ListManagedKeyPresence(path)
	if err != nil {
		t.Fatal(err)
	}
	foundHelius := false
	for _, p := range presence {
		if p.Name == "HELIUS_API_KEY" {
			foundHelius = true
			if !p.Set {
				t.Fatal("HELIUS should be set")
			}
			// Never leak values in presence struct JSON shape — Set only
		}
		if p.Name == "OPENROUTER_API_KEY" && p.Set && p.Source == "file" {
			t.Fatal("cleared openrouter should not be file-set")
		}
	}
	if !foundHelius {
		t.Fatal("HELIUS missing from presence list")
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}
