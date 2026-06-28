package main

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

// ServiceInfo is the view of a Windows service sent to the frontend.
type ServiceInfo struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	State       string `json:"state"`
	StartType   string `json:"startType"`
	PID         uint32 `json:"pid"`
	Account     string `json:"account"`
	Description string `json:"description"`
}

// ActionResult reports the outcome of an operation on a single service.
type ActionResult struct {
	Name  string `json:"name"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

func stateString(s svc.State) string {
	switch s {
	case svc.Stopped:
		return "Stopped"
	case svc.StartPending:
		return "Starting"
	case svc.StopPending:
		return "Stopping"
	case svc.Running:
		return "Running"
	case svc.ContinuePending:
		return "Resuming"
	case svc.PausePending:
		return "Pausing"
	case svc.Paused:
		return "Paused"
	default:
		return "Unknown"
	}
}

func startTypeString(t uint32, delayed bool) string {
	switch t {
	case mgr.StartAutomatic:
		if delayed {
			return "Automatic (Delayed)"
		}
		return "Automatic"
	case mgr.StartManual:
		return "Manual"
	case mgr.StartDisabled:
		return "Disabled"
	case windows.SERVICE_BOOT_START:
		return "Boot"
	case windows.SERVICE_SYSTEM_START:
		return "System"
	default:
		return "Unknown"
	}
}

func startTypeValue(name string) (uint32, error) {
	switch strings.ToLower(name) {
	case "auto", "automatic":
		return mgr.StartAutomatic, nil
	case "manual", "demand":
		return mgr.StartManual, nil
	case "disabled":
		return mgr.StartDisabled, nil
	default:
		return 0, fmt.Errorf("unknown start type %q", name)
	}
}

// listServices enumerates every service using read-only access so that we can
// still report services that deny full access.
func listServices() ([]ServiceInfo, error) {
	m, err := mgr.Connect()
	if err != nil {
		return nil, fmt.Errorf("connect to service manager: %w", err)
	}
	defer m.Disconnect()

	names, err := m.ListServices()
	if err != nil {
		return nil, fmt.Errorf("list services: %w", err)
	}

	out := make([]ServiceInfo, 0, len(names))
	for _, name := range names {
		info := ServiceInfo{Name: name}

		ptr, err := windows.UTF16PtrFromString(name)
		if err != nil {
			out = append(out, info)
			continue
		}
		h, err := windows.OpenService(m.Handle, ptr,
			windows.SERVICE_QUERY_CONFIG|windows.SERVICE_QUERY_STATUS)
		if err != nil {
			// Can't open it; still surface the name with an Unknown state.
			info.State = "Unknown"
			info.StartType = "Unknown"
			out = append(out, info)
			continue
		}

		s := &mgr.Service{Name: name, Handle: h}
		if cfg, err := s.Config(); err == nil {
			info.DisplayName = cfg.DisplayName
			info.Account = cfg.ServiceStartName
			info.Description = cfg.Description
			info.StartType = startTypeString(cfg.StartType, cfg.DelayedAutoStart)
		} else {
			info.StartType = "Unknown"
		}
		if st, err := s.Query(); err == nil {
			info.State = stateString(st.State)
			info.PID = st.ProcessId
		} else {
			info.State = "Unknown"
		}
		s.Close()

		if info.DisplayName == "" {
			info.DisplayName = name
		}
		out = append(out, info)
	}

	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

func withService(name string, fn func(*mgr.Service) error) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect to service manager: %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(name)
	if err != nil {
		return fmt.Errorf("open %s: %w", name, err)
	}
	defer s.Close()
	return fn(s)
}

func startService(name string) error {
	return withService(name, func(s *mgr.Service) error {
		if st, err := s.Query(); err == nil && st.State == svc.Running {
			return nil
		}
		if err := s.Start(); err != nil {
			return fmt.Errorf("start %s: %w", name, err)
		}
		return nil
	})
}

func stopService(name string) error {
	return withService(name, func(s *mgr.Service) error {
		return stopHandle(name, s)
	})
}

func stopHandle(name string, s *mgr.Service) error {
	st, err := s.Query()
	if err == nil && st.State == svc.Stopped {
		return nil
	}
	status, err := s.Control(svc.Stop)
	if err != nil {
		return fmt.Errorf("stop %s: %w", name, err)
	}
	timeout := time.Now().Add(30 * time.Second)
	for status.State != svc.Stopped {
		if time.Now().After(timeout) {
			return fmt.Errorf("timed out waiting for %s to stop", name)
		}
		time.Sleep(300 * time.Millisecond)
		status, err = s.Query()
		if err != nil {
			return fmt.Errorf("query %s: %w", name, err)
		}
	}
	return nil
}

func restartService(name string) error {
	return withService(name, func(s *mgr.Service) error {
		if err := stopHandle(name, s); err != nil {
			return err
		}
		if err := s.Start(); err != nil {
			return fmt.Errorf("start %s: %w", name, err)
		}
		return nil
	})
}

func setStartType(name string, startType uint32) error {
	return withService(name, func(s *mgr.Service) error {
		cfg, err := s.Config()
		if err != nil {
			return fmt.Errorf("read config %s: %w", name, err)
		}
		cfg.StartType = startType
		if startType != mgr.StartAutomatic {
			cfg.DelayedAutoStart = false
		}
		if err := s.UpdateConfig(cfg); err != nil {
			return fmt.Errorf("update config %s: %w", name, err)
		}
		return nil
	})
}

func runBatch(names []string, fn func(string) error) []ActionResult {
	results := make([]ActionResult, 0, len(names))
	for _, name := range names {
		r := ActionResult{Name: name, OK: true}
		if err := fn(name); err != nil {
			r.OK = false
			r.Error = err.Error()
		}
		results = append(results, r)
	}
	return results
}
