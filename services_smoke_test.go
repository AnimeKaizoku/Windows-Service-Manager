package main

import "testing"

// Smoke test: verify service enumeration returns data on this machine.
// Requires administrator privileges (the service control manager needs it).
func TestListServicesSmoke(t *testing.T) {
	svcs, err := listServices()
	if err != nil {
		t.Skipf("listServices error (likely needs admin): %v", err)
	}
	if len(svcs) == 0 {
		t.Fatal("expected at least one service")
	}
	withAccount := 0
	for _, s := range svcs {
		if s.Account != "" {
			withAccount++
		}
	}
	t.Logf("enumerated %d services, %d with an account, first=%q state=%q start=%q acct=%q",
		len(svcs), withAccount, svcs[0].Name, svcs[0].State, svcs[0].StartType, svcs[0].Account)
}
