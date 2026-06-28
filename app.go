package main

import (
	"context"
)

// App is the Wails-bound application object.
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct.
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// ---- Service queries ----

// ListServices returns every Windows service with its current state.
func (a *App) ListServices() ([]ServiceInfo, error) {
	return listServices()
}

// ---- Service actions (batched) ----

func (a *App) StartServices(names []string) []ActionResult {
	return runBatch(names, startService)
}

func (a *App) StopServices(names []string) []ActionResult {
	return runBatch(names, stopService)
}

func (a *App) RestartServices(names []string) []ActionResult {
	return runBatch(names, restartService)
}

// SetStartType sets the startup type ("auto", "manual" or "disabled") for the
// given services.
func (a *App) SetStartType(names []string, startType string) []ActionResult {
	value, err := startTypeValue(startType)
	if err != nil {
		results := make([]ActionResult, 0, len(names))
		for _, n := range names {
			results = append(results, ActionResult{Name: n, OK: false, Error: err.Error()})
		}
		return results
	}
	return runBatch(names, func(name string) error {
		return setStartType(name, value)
	})
}

// ---- Config / custom views ----

func (a *App) GetConfig() (Config, error) {
	return loadConfig()
}

func (a *App) SaveConfig(cfg Config) error {
	return saveConfig(cfg)
}
