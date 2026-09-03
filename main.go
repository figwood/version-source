package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"gopkg.in/yaml.v3"
)

const (
	defaultAddress    = ":8080"
	defaultConfigFile = "data.yml"
	maxPageSize       = 50
)

type Config struct {
	Server   ServerConfig `yaml:"server"`
	Token    string       `yaml:"token"`
	Services []Service    `yaml:"services"`
}

type ServerConfig struct {
	Address string `yaml:"address"`
}

type Service struct {
	ID       string    `yaml:"id" json:"id"`
	Name     string    `yaml:"name" json:"name"`
	Versions []Version `yaml:"versions" json:"-"`
}

type Version struct {
	ID        string `yaml:"id" json:"id"`
	Name      string `yaml:"name" json:"name"`
	CreatedAt string `yaml:"createdAt,omitempty" json:"createdAt,omitempty"`
}

type listResponse[T any] struct {
	Items      []T     `json:"items"`
	NextCursor *string `json:"nextCursor"`
}

type errorResponse struct {
	Error string `json:"error"`
}

type catalogServer struct {
	token    string
	services []Service
	byID     map[string]Service
}

func main() {
	configFile := envOrDefault("CONFIG_FILE", defaultConfigFile)
	config, err := loadConfig(configFile)
	if err != nil {
		slog.Error("failed to load configuration", "file", configFile, "error", err)
		os.Exit(1)
	}

	address := config.Server.Address
	if port := strings.TrimSpace(os.Getenv("MOCK_CATALOG_PORT")); port != "" {
		address = ":" + port
	}
	if port := strings.TrimSpace(os.Getenv("PORT")); port != "" {
		address = ":" + port
	}
	if address == "" {
		address = defaultAddress
	}
	token := config.Token
	if value := os.Getenv("MOCK_CATALOG_TOKEN"); value != "" {
		token = value
	}

	handler := newCatalogServer(token, config.Services)
	server := &http.Server{
		Addr:              address,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stop
		slog.Info("shutting down")
		_ = server.Close()
	}()

	slog.Info("version source listening", "address", address, "config", configFile)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("server stopped unexpectedly", "error", err)
		os.Exit(1)
	}
}

func envOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func loadConfig(path string) (Config, error) {
	file, err := os.Open(path)
	if err != nil {
		return Config{}, err
	}
	defer file.Close()

	var config Config
	decoder := yaml.NewDecoder(file)
	decoder.KnownFields(true)
	if err := decoder.Decode(&config); err != nil {
		return Config{}, fmt.Errorf("decode YAML: %w", err)
	}
	if err := validateConfig(config); err != nil {
		return Config{}, err
	}
	return config, nil
}

func validateConfig(config Config) error {
	if strings.TrimSpace(config.Token) == "" {
		return errors.New("token must not be empty")
	}
	serviceIDs := make(map[string]struct{}, len(config.Services))
	for i, service := range config.Services {
		if strings.TrimSpace(service.ID) == "" || strings.TrimSpace(service.Name) == "" {
			return fmt.Errorf("services[%d]: id and name must not be empty", i)
		}
		if _, exists := serviceIDs[service.ID]; exists {
			return fmt.Errorf("services[%d]: duplicate id %q", i, service.ID)
		}
		serviceIDs[service.ID] = struct{}{}

		versionIDs := make(map[string]struct{}, len(service.Versions))
		for j, version := range service.Versions {
			if strings.TrimSpace(version.ID) == "" || strings.TrimSpace(version.Name) == "" {
				return fmt.Errorf("services[%d].versions[%d]: id and name must not be empty", i, j)
			}
			if _, exists := versionIDs[version.ID]; exists {
				return fmt.Errorf("services[%d].versions[%d]: duplicate id %q", i, j, version.ID)
			}
			versionIDs[version.ID] = struct{}{}
		}
	}
	return nil
}

func newCatalogServer(token string, services []Service) http.Handler {
	byID := make(map[string]Service, len(services))
	for _, service := range services {
		byID[service.ID] = service
	}
	return &catalogServer{token: token, services: services, byID: byID}
}

func (s *catalogServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
		return
	}
	if r.URL.Path == "/catalog/v1/health" {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	if r.Header.Get("Authorization") != "Bearer "+s.token {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "unauthorized"})
		return
	}

	switch r.URL.Path {
	case "/catalog/v1/services":
		s.listServices(w, r)
		return
	}

	const prefix = "/catalog/v1/services/"
	const suffix = "/versions"
	escapedPath := r.URL.EscapedPath()
	if strings.HasPrefix(escapedPath, prefix) && strings.HasSuffix(escapedPath, suffix) {
		escapedID := strings.TrimSuffix(strings.TrimPrefix(escapedPath, prefix), suffix)
		if escapedID != "" && !strings.Contains(escapedID, "/") {
			serviceID, err := url.PathUnescape(escapedID)
			if err == nil {
				s.listVersions(w, r, serviceID)
				return
			}
		}
	}
	writeJSON(w, http.StatusNotFound, errorResponse{Error: "not_found"})
}

func (s *catalogServer) listServices(w http.ResponseWriter, r *http.Request) {
	query, cursor, limit, ok := pagination(r)
	if !ok {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_pagination"})
		return
	}
	items := make([]Service, 0, len(s.services))
	for _, service := range s.services {
		if matches(service.ID, service.Name, query) {
			items = append(items, Service{ID: service.ID, Name: service.Name})
		}
	}
	writeJSON(w, http.StatusOK, makePage(items, cursor, limit))
}

func (s *catalogServer) listVersions(w http.ResponseWriter, r *http.Request, serviceID string) {
	service, exists := s.byID[serviceID]
	if !exists {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "service_not_found"})
		return
	}
	query, cursor, limit, ok := pagination(r)
	if !ok {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_pagination"})
		return
	}
	items := make([]Version, 0, len(service.Versions))
	for _, version := range service.Versions {
		if matches(version.ID, version.Name, query) {
			items = append(items, version)
		}
	}
	writeJSON(w, http.StatusOK, makePage(items, cursor, limit))
}

func pagination(r *http.Request) (query string, cursor int, limit int, ok bool) {
	query = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("query")))
	limit = maxPageSize
	if raw := r.URL.Query().Get("limit"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 {
			return "", 0, 0, false
		}
		if value < maxPageSize {
			limit = value
		}
	}
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 0 {
			return "", 0, 0, false
		}
		cursor = value
	}
	return query, cursor, limit, true
}

func matches(id, name, query string) bool {
	return query == "" || strings.Contains(strings.ToLower(id), query) ||
		strings.Contains(strings.ToLower(name), query)
}

func makePage[T any](items []T, cursor, limit int) listResponse[T] {
	if cursor > len(items) {
		cursor = len(items)
	}
	end := cursor + limit
	if end > len(items) {
		end = len(items)
	}
	pageItems := items[cursor:end]
	if pageItems == nil {
		pageItems = make([]T, 0)
	}

	var nextCursor *string
	if end < len(items) {
		value := strconv.Itoa(end)
		nextCursor = &value
	}
	return listResponse[T]{Items: pageItems, NextCursor: nextCursor}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("failed to write response", "error", err)
	}
}
