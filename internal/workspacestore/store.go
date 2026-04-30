package workspacestore

import (
	"context"
	"encoding/json"
	"errors"

	anystore "github.com/anyproto/any-store"
	"github.com/anyproto/any-store/anyenc"
)

const rootDocumentID = "workspace:root"

type Store struct {
	db anystore.DB
}

type RootDocument struct {
	ID       string `json:"id"`
	RootPath string `json:"rootPath"`
	Name     string `json:"name"`
}

type PropertyValueDocument struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspaceId"`
	ObjectID    string `json:"objectId"`
	PropertyID  string `json:"propertyId"`
	Type        string `json:"type"`
	Value       any    `json:"value"`
}

func Open(ctx context.Context, path string) (*Store, error) {
	db, err := anystore.Open(ctx, path, nil)
	if err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) SetRoot(ctx context.Context, root RootDocument) error {
	root.ID = rootDocumentID
	return s.upsertJSON(ctx, "workspaces", root)
}

func (s *Store) GetRoot(ctx context.Context) (RootDocument, error) {
	coll, err := s.db.Collection(ctx, "workspaces")
	if err != nil {
		return RootDocument{}, err
	}

	doc, err := coll.FindId(ctx, rootDocumentID)
	if err != nil {
		if errors.Is(err, anystore.ErrDocNotFound) {
			return RootDocument{}, nil
		}
		return RootDocument{}, err
	}

	var root RootDocument
	if err := json.Unmarshal([]byte(doc.Value().String()), &root); err != nil {
		return RootDocument{}, err
	}
	return root, nil
}

func (s *Store) UpsertPropertyValue(ctx context.Context, value PropertyValueDocument) error {
	return s.upsertJSON(ctx, "property_values", value)
}

func (s *Store) ListPropertyValues(ctx context.Context, workspaceID string) ([]PropertyValueDocument, error) {
	coll, err := s.db.Collection(ctx, "property_values")
	if err != nil {
		return nil, err
	}

	iter, err := coll.Find(map[string]any{"workspaceId": workspaceID}).Iter(ctx)
	if err != nil {
		return nil, err
	}

	var values []PropertyValueDocument
	for iter.Next() {
		doc, err := iter.Doc()
		if err != nil {
			_ = iter.Close()
			return nil, err
		}

		var value PropertyValueDocument
		if err := json.Unmarshal([]byte(doc.Value().String()), &value); err != nil {
			_ = iter.Close()
			return nil, err
		}
		values = append(values, value)
	}
	if err := iter.Err(); err != nil {
		_ = iter.Close()
		return nil, err
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}
	return values, nil
}

func (s *Store) upsertJSON(ctx context.Context, collectionName string, doc any) error {
	data, err := json.Marshal(doc)
	if err != nil {
		return err
	}

	value, err := anyenc.ParseJson(string(data))
	if err != nil {
		return err
	}

	coll, err := s.db.Collection(ctx, collectionName)
	if err != nil {
		return err
	}
	return coll.UpsertOne(ctx, value)
}
