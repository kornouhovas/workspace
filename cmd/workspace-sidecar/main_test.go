package main

import (
	"context"
	"path/filepath"
	"testing"

	"workspace/internal/workspacestore"
)

func TestNormalizeCreatedPropertyDocumentAllowsDuplicateNamesByDistinctID(t *testing.T) {
	ctx := context.Background()
	store, err := workspacestore.Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	firstProperty := workspacestore.PropertyDefinitionDocument{
		WorkspaceID: "workspace:ops",
		Name:        "Text",
		Type:        "text",
	}
	if err := normalizeCreatedPropertyDocument(ctx, store, &firstProperty); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertPropertyDefinition(ctx, firstProperty); err != nil {
		t.Fatal(err)
	}

	secondProperty := workspacestore.PropertyDefinitionDocument{
		WorkspaceID: "workspace:ops",
		Name:        "Text",
		Type:        "text",
	}
	if err := normalizeCreatedPropertyDocument(ctx, store, &secondProperty); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertPropertyDefinition(ctx, secondProperty); err != nil {
		t.Fatal(err)
	}

	if firstProperty.ID == "" || secondProperty.ID == "" || firstProperty.ID == secondProperty.ID {
		t.Fatalf("expected distinct generated property ids, got %q and %q", firstProperty.ID, secondProperty.ID)
	}
	if firstProperty.Type != "propertyDefinition" || firstProperty.PropertyType != "text" {
		t.Fatalf("expected first property type normalization, got %#v", firstProperty)
	}
	if secondProperty.Type != "propertyDefinition" || secondProperty.PropertyType != "text" {
		t.Fatalf("expected second property type normalization, got %#v", secondProperty)
	}
	if firstProperty.Order != 10 || secondProperty.Order != 20 {
		t.Fatalf("expected order to advance by id-backed documents, got %d and %d", firstProperty.Order, secondProperty.Order)
	}
}

func TestNormalizeCreatedPropertyDocumentRejectsDuplicateID(t *testing.T) {
	ctx := context.Background()
	store, err := workspacestore.Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	existingProperty := workspacestore.PropertyDefinitionDocument{
		ID:           "property:client-generated",
		WorkspaceID:  "workspace:ops",
		Name:         "Text",
		PropertyType: "text",
	}
	if err := normalizeCreatedPropertyDocument(ctx, store, &existingProperty); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertPropertyDefinition(ctx, existingProperty); err != nil {
		t.Fatal(err)
	}

	duplicateProperty := workspacestore.PropertyDefinitionDocument{
		ID:           existingProperty.ID,
		WorkspaceID:  "workspace:ops",
		Name:         "Text",
		PropertyType: "text",
	}
	if err := normalizeCreatedPropertyDocument(ctx, store, &duplicateProperty); err == nil {
		t.Fatal("expected duplicate property id to be rejected")
	}
}
