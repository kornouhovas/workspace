package workspacestore

import (
	"context"
	"encoding/json"
	"errors"
	"sort"

	anystore "github.com/anyproto/any-store"
	"github.com/anyproto/any-store/anyenc"
)

const rootDocumentID = "workspace:root"

var ErrReservedWorkspaceID = errors.New("workspace id is reserved")

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

type WorkspaceDocument struct {
	ID             string  `json:"id"`
	Type           string  `json:"type"`
	SchemaVersion  int     `json:"schemaVersion"`
	SourceFolderID string  `json:"sourceFolderId"`
	Name           string  `json:"name"`
	Order          int     `json:"order"`
	ActiveViewID   string  `json:"activeViewId"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
	DeletedAt      *string `json:"deletedAt"`
}

type ValueVisibilityDocument struct {
	Mode         string   `json:"mode"`
	ValueIDs     []string `json:"valueIds"`
	IncludeEmpty bool     `json:"includeEmpty"`
}

type ViewDocument struct {
	ID                 string                             `json:"id"`
	Type               string                             `json:"type"`
	SchemaVersion      int                                `json:"schemaVersion"`
	WorkspaceID        string                             `json:"workspaceId"`
	Name               string                             `json:"name"`
	ViewType           string                             `json:"viewType"`
	Order              int                                `json:"order"`
	VisiblePropertyIDs []string                           `json:"visiblePropertyIds"`
	HiddenPropertyIDs  []string                           `json:"hiddenPropertyIds"`
	PropertyOrder      map[string]int                     `json:"propertyOrder"`
	ValueVisibility    map[string]ValueVisibilityDocument `json:"valueVisibility"`
	CreatedAt          string                             `json:"createdAt"`
	UpdatedAt          string                             `json:"updatedAt"`
	DeletedAt          *string                            `json:"deletedAt"`
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

func (s *Store) UpsertWorkspace(ctx context.Context, workspace WorkspaceDocument) error {
	if workspace.ID == rootDocumentID {
		return ErrReservedWorkspaceID
	}
	if workspace.Type == "" {
		workspace.Type = "workspace"
	}
	if workspace.SchemaVersion == 0 {
		workspace.SchemaVersion = 1
	}
	return s.upsertJSON(ctx, "workspaces", workspace)
}

func (s *Store) GetWorkspace(ctx context.Context, id string) (WorkspaceDocument, error) {
	if id == rootDocumentID {
		return WorkspaceDocument{}, nil
	}

	coll, err := s.db.Collection(ctx, "workspaces")
	if err != nil {
		return WorkspaceDocument{}, err
	}

	doc, err := coll.FindId(ctx, id)
	if err != nil {
		if errors.Is(err, anystore.ErrDocNotFound) {
			return WorkspaceDocument{}, nil
		}
		return WorkspaceDocument{}, err
	}

	var workspace WorkspaceDocument
	if err := json.Unmarshal([]byte(doc.Value().String()), &workspace); err != nil {
		return WorkspaceDocument{}, err
	}
	return workspace, nil
}

func (s *Store) UpsertView(ctx context.Context, view ViewDocument) error {
	if view.Type == "" {
		view.Type = "view"
	}
	if view.SchemaVersion == 0 {
		view.SchemaVersion = 1
	}
	if view.HiddenPropertyIDs == nil {
		view.HiddenPropertyIDs = []string{}
	}
	if view.PropertyOrder == nil {
		view.PropertyOrder = map[string]int{}
	}
	if view.ValueVisibility == nil {
		view.ValueVisibility = map[string]ValueVisibilityDocument{}
	}
	return s.upsertJSON(ctx, "views", view)
}

func (s *Store) GetView(ctx context.Context, id string) (ViewDocument, error) {
	coll, err := s.db.Collection(ctx, "views")
	if err != nil {
		return ViewDocument{}, err
	}

	doc, err := coll.FindId(ctx, id)
	if err != nil {
		if errors.Is(err, anystore.ErrDocNotFound) {
			return ViewDocument{}, nil
		}
		return ViewDocument{}, err
	}

	var view ViewDocument
	if err := json.Unmarshal([]byte(doc.Value().String()), &view); err != nil {
		return ViewDocument{}, err
	}
	return view, nil
}

func (s *Store) ListViews(ctx context.Context, workspaceID string) ([]ViewDocument, error) {
	coll, err := s.db.Collection(ctx, "views")
	if err != nil {
		return nil, err
	}

	iter, err := coll.Find(map[string]any{"workspaceId": workspaceID}).Iter(ctx)
	if err != nil {
		return nil, err
	}

	var views []ViewDocument
	for iter.Next() {
		doc, err := iter.Doc()
		if err != nil {
			_ = iter.Close()
			return nil, err
		}

		var view ViewDocument
		if err := json.Unmarshal([]byte(doc.Value().String()), &view); err != nil {
			_ = iter.Close()
			return nil, err
		}
		if view.DeletedAt == nil {
			views = append(views, view)
		}
	}
	if err := iter.Err(); err != nil {
		_ = iter.Close()
		return nil, err
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}

	sort.SliceStable(views, func(i, j int) bool {
		if views[i].Order == views[j].Order {
			return views[i].CreatedAt < views[j].CreatedAt
		}
		return views[i].Order < views[j].Order
	})
	return views, nil
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
