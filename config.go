package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// View is a user-defined grouping of services. A view can match services by
// logon account (substring, case-insensitive), by an explicit list of service
// names, or both. An empty view matches everything.
type View struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Account  string   `json:"account"`  // logon-account filter (substring)
	Services []string `json:"services"` // explicit service names
}

// Config is the persisted application state.
type Config struct {
	Views     []View   `json:"views"`
	Favorites []string `json:"favorites"`
	Theme     string   `json:"theme"`
}

func configPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(dir, "KaizokuServiceManager")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(appDir, "config.json"), nil
}

func loadConfig() (Config, error) {
	cfg := Config{Views: []View{}, Favorites: []string{}}
	path, err := configPath()
	if err != nil {
		return cfg, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return cfg, err
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, err
	}
	if cfg.Views == nil {
		cfg.Views = []View{}
	}
	if cfg.Favorites == nil {
		cfg.Favorites = []string{}
	}
	return cfg, nil
}

func saveConfig(cfg Config) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
