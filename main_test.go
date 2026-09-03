package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func testHandler() http.Handler {
	return newCatalogServer("secret", []Service{
		{ID: "a/b", Name: "Payments API", Versions: []Version{
			{ID: "2.4.1", Name: "Release 2.4.1", CreatedAt: "2026-09-01T08:00:00Z"},
			{ID: "2.4.0", Name: "Release 2.4.0"},
		}},
		{ID: "orders", Name: "Orders API"},
	})
}

func request(t *testing.T, handler http.Handler, path, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}

func TestHealthDoesNotRequireToken(t *testing.T) {
	handler := testHandler()
	response := request(t, handler, "/catalog/v1/health", "")
	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != `{"status":"ok"}` {
		t.Fatalf("unexpected response: %d %s", response.Code, response.Body.String())
	}
}

func TestCatalogStillRequiresToken(t *testing.T) {
	response := request(t, testHandler(), "/catalog/v1/services", "")
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("without token: got status %d", response.Code)
	}
}

func TestServicesSearchAndPagination(t *testing.T) {
	response := request(t, testHandler(), "/catalog/v1/services?query=api&limit=1", "secret")
	if response.Code != http.StatusOK {
		t.Fatalf("got status %d", response.Code)
	}
	var body listResponse[Service]
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Items) != 1 || body.Items[0].ID != "a/b" || body.NextCursor == nil || *body.NextCursor != "1" {
		t.Fatalf("unexpected page: %#v", body)
	}
}

func TestVersionsSupportsEncodedServiceID(t *testing.T) {
	path := "/catalog/v1/services/" + url.PathEscape("a/b") + "/versions?query=2.4.1"
	response := request(t, testHandler(), path, "secret")
	if response.Code != http.StatusOK {
		t.Fatalf("got status %d: %s", response.Code, response.Body.String())
	}
	var body listResponse[Version]
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Items) != 1 || body.Items[0].CreatedAt == "" {
		t.Fatalf("unexpected versions: %#v", body.Items)
	}
}

func TestUnknownServiceAndInvalidPagination(t *testing.T) {
	missing := request(t, testHandler(), "/catalog/v1/services/missing/versions", "secret")
	if missing.Code != http.StatusNotFound || !strings.Contains(missing.Body.String(), "service_not_found") {
		t.Fatalf("unexpected missing response: %d %s", missing.Code, missing.Body.String())
	}
	invalid := request(t, testHandler(), "/catalog/v1/services?cursor=-1", "secret")
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid cursor: got status %d", invalid.Code)
	}
}

func TestValidateConfigRejectsDuplicateIDs(t *testing.T) {
	config := Config{Token: "token", Services: []Service{{ID: "same", Name: "A"}, {ID: "same", Name: "B"}}}
	if err := validateConfig(config); err == nil {
		t.Fatal("expected duplicate service ID error")
	}
}

func TestLoadBundledConfig(t *testing.T) {
	config, err := loadConfig("data.yml")
	if err != nil {
		t.Fatal(err)
	}
	if config.Token != "dev-token" || len(config.Services) != 3 {
		t.Fatalf("unexpected config: token=%q services=%d", config.Token, len(config.Services))
	}
	if config.Services[0].Versions[0].ID != "2.4.1" {
		t.Fatalf("version ID must be decoded as a string: %#v", config.Services[0].Versions[0])
	}
}
