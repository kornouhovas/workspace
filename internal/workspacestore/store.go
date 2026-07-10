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
var ErrInvalidViewOrder = errors.New("invalid view order")

type Store struct {
	db anystore.DB
}

type RootDocument struct {
	ID       string `json:"id"`
	RootPath string `json:"rootPath"`
	Name     string `json:"name"`
}

type PropertyValueDocument struct {
	ID            string  `json:"id"`
	WorkspaceID   string  `json:"workspaceId"`
	ObjectID      string  `json:"objectId"`
	ProjectID     string  `json:"projectId"`
	PropertyID    string  `json:"propertyId"`
	Type          string  `json:"type"`
	SchemaVersion int     `json:"schemaVersion"`
	PropertyType  string  `json:"propertyType"`
	Value         any     `json:"value"`
	CreatedAt     string  `json:"createdAt"`
	UpdatedAt     string  `json:"updatedAt"`
	DeletedAt     *string `json:"deletedAt"`
}

type PropertyDefinitionDocument struct {
	ID            string         `json:"id"`
	Type          string         `json:"type"`
	SchemaVersion int            `json:"schemaVersion"`
	WorkspaceID   string         `json:"workspaceId"`
	Name          string         `json:"name"`
	PropertyType  string         `json:"propertyType"`
	System        bool           `json:"system"`
	Hidden        bool           `json:"hidden"`
	Order         int            `json:"order"`
	Config        map[string]any `json:"config"`
	CreatedAt     string         `json:"createdAt"`
	UpdatedAt     string         `json:"updatedAt"`
	DeletedAt     *string        `json:"deletedAt"`
}

type SelectValueDocument struct {
	ID            string  `json:"id"`
	Type          string  `json:"type"`
	SchemaVersion int     `json:"schemaVersion"`
	WorkspaceID   string  `json:"workspaceId"`
	PropertyID    string  `json:"propertyId"`
	Name          string  `json:"name"`
	Color         string  `json:"color"`
	Hidden        bool    `json:"hidden"`
	Order         int     `json:"order"`
	CreatedAt     string  `json:"createdAt"`
	UpdatedAt     string  `json:"updatedAt"`
	DeletedAt     *string `json:"deletedAt"`
}

type PropertyHistoryDocument struct {
	ID            string `json:"id"`
	Type          string `json:"type"`
	SchemaVersion int    `json:"schemaVersion"`
	WorkspaceID   string `json:"workspaceId"`
	ProjectID     string `json:"projectId"`
	PropertyID    string `json:"propertyId"`
	TargetType    string `json:"targetType"`
	TargetID      string `json:"targetId"`
	Action        string `json:"action"`
	PreviousValue any    `json:"previousValue"`
	NextValue     any    `json:"nextValue"`
	CreatedAt     string `json:"createdAt"`
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

type PropertyLayoutDocument struct {
	WrapContent bool `json:"wrapContent"`
}

type BoardLayoutDocument struct {
	ColumnWidth int `json:"columnWidth"`
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
	PropertyLayout     map[string]PropertyLayoutDocument  `json:"propertyLayout"`
	BoardLayout        BoardLayoutDocument                `json:"boardLayout"`
	CreatedAt          string                             `json:"createdAt"`
	UpdatedAt          string                             `json:"updatedAt"`
	DeletedAt          *string                            `json:"deletedAt"`
}

type WorkspaceDocumentBatch struct {
	PropertyDefinitions []PropertyDefinitionDocument `json:"propertyDefinitions"`
	SelectValues        []SelectValueDocument        `json:"selectValues"`
	PropertyValues      []PropertyValueDocument      `json:"propertyValues"`
	Views               []ViewDocument               `json:"views"`
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
	view = normalizeViewDocument(view)
	return s.upsertJSON(ctx, "views", view)
}

func normalizeViewDocument(view ViewDocument) ViewDocument {
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
	return view
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

func (s *Store) ReorderViews(ctx context.Context, workspaceID string, orderedViewIDs []string, updatedAt string) ([]ViewDocument, error) {
	views, err := s.ListViews(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	viewsByID := make(map[string]ViewDocument, len(views))
	for _, view := range views {
		viewsByID[view.ID] = view
	}

	seen := make(map[string]bool, len(orderedViewIDs))
	for _, viewID := range orderedViewIDs {
		if viewID == "" || seen[viewID] {
			return nil, ErrInvalidViewOrder
		}
		if _, ok := viewsByID[viewID]; !ok {
			return nil, ErrInvalidViewOrder
		}
		seen[viewID] = true
	}
	if len(seen) != len(viewsByID) {
		return nil, ErrInvalidViewOrder
	}

	reordered := make([]ViewDocument, 0, len(orderedViewIDs))
	reorderedValues := make([]*anyenc.Value, 0, len(orderedViewIDs))
	for index, viewID := range orderedViewIDs {
		view := normalizeViewDocument(viewsByID[viewID])
		view.Order = (index + 1) * 10
		view.UpdatedAt = updatedAt
		value, err := marshalJSONValue(view)
		if err != nil {
			return nil, err
		}
		reordered = append(reordered, view)
		reorderedValues = append(reorderedValues, value)
	}

	coll, err := s.db.Collection(ctx, "views")
	if err != nil {
		return nil, err
	}

	tx, err := s.db.WriteTx(ctx)
	if err != nil {
		return nil, err
	}

	for _, value := range reorderedValues {
		if err := coll.UpsertOne(tx.Context(), value); err != nil {
			if rollbackErr := tx.Rollback(); rollbackErr != nil {
				return nil, errors.Join(err, rollbackErr)
			}
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return reordered, nil
}

func (s *Store) UpsertPropertyValue(ctx context.Context, value PropertyValueDocument) error {
	return s.upsertJSON(ctx, "property_values", normalizePropertyValueDocument(value))
}

func normalizePropertyValueDocument(value PropertyValueDocument) PropertyValueDocument {
	if value.Type == "" {
		value.Type = "projectPropertyValue"
	}
	if value.SchemaVersion == 0 {
		value.SchemaVersion = 1
	}
	return value
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
		if value.DeletedAt == nil {
			values = append(values, value)
		}
	}
	if err := iter.Err(); err != nil {
		_ = iter.Close()
		return nil, err
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}
	sort.SliceStable(values, func(i, j int) bool {
		if values[i].PropertyID == values[j].PropertyID {
			if values[i].ProjectID == values[j].ProjectID {
				return values[i].ID < values[j].ID
			}
			return values[i].ProjectID < values[j].ProjectID
		}
		return values[i].PropertyID < values[j].PropertyID
	})
	return values, nil
}

func (s *Store) UpsertPropertyDefinition(ctx context.Context, property PropertyDefinitionDocument) error {
	property = normalizePropertyDefinitionDocument(property)
	return s.upsertJSON(ctx, "property_definitions", property)
}

func normalizePropertyDefinitionDocument(property PropertyDefinitionDocument) PropertyDefinitionDocument {
	if property.Type == "" {
		property.Type = "propertyDefinition"
	}
	if property.SchemaVersion == 0 {
		property.SchemaVersion = 1
	}
	if property.Config == nil {
		property.Config = map[string]any{}
	}
	return property
}

func (s *Store) UpsertPropertyDefinitions(ctx context.Context, properties []PropertyDefinitionDocument) error {
	values := make([]*anyenc.Value, 0, len(properties))
	for _, property := range properties {
		value, err := marshalJSONValue(normalizePropertyDefinitionDocument(property))
		if err != nil {
			return err
		}
		values = append(values, value)
	}
	return s.upsertJSONValues(ctx, "property_definitions", values)
}

func (s *Store) UpsertWorkspaceDocumentBatch(ctx context.Context, batch WorkspaceDocumentBatch) error {
	batches := make([]jsonCollectionValueBatch, 0, 4)

	if len(batch.PropertyDefinitions) > 0 {
		values := make([]*anyenc.Value, 0, len(batch.PropertyDefinitions))
		for _, property := range batch.PropertyDefinitions {
			value, err := marshalJSONValue(normalizePropertyDefinitionDocument(property))
			if err != nil {
				return err
			}
			values = append(values, value)
		}
		batches = append(batches, jsonCollectionValueBatch{collectionName: "property_definitions", values: values})
	}

	if len(batch.SelectValues) > 0 {
		values := make([]*anyenc.Value, 0, len(batch.SelectValues))
		for _, selectValue := range batch.SelectValues {
			value, err := marshalJSONValue(normalizeSelectValueDocument(selectValue))
			if err != nil {
				return err
			}
			values = append(values, value)
		}
		batches = append(batches, jsonCollectionValueBatch{collectionName: "select_values", values: values})
	}

	if len(batch.PropertyValues) > 0 {
		values := make([]*anyenc.Value, 0, len(batch.PropertyValues))
		for _, propertyValue := range batch.PropertyValues {
			value, err := marshalJSONValue(normalizePropertyValueDocument(propertyValue))
			if err != nil {
				return err
			}
			values = append(values, value)
		}
		batches = append(batches, jsonCollectionValueBatch{collectionName: "property_values", values: values})
	}

	if len(batch.Views) > 0 {
		values := make([]*anyenc.Value, 0, len(batch.Views))
		for _, view := range batch.Views {
			value, err := marshalJSONValue(normalizeViewDocument(view))
			if err != nil {
				return err
			}
			values = append(values, value)
		}
		batches = append(batches, jsonCollectionValueBatch{collectionName: "views", values: values})
	}

	return s.upsertJSONCollectionValues(ctx, batches)
}

func (s *Store) ListPropertyDefinitions(ctx context.Context, workspaceID string) ([]PropertyDefinitionDocument, error) {
	coll, err := s.db.Collection(ctx, "property_definitions")
	if err != nil {
		return nil, err
	}

	iter, err := coll.Find(map[string]any{"workspaceId": workspaceID}).Iter(ctx)
	if err != nil {
		return nil, err
	}

	var properties []PropertyDefinitionDocument
	for iter.Next() {
		doc, err := iter.Doc()
		if err != nil {
			_ = iter.Close()
			return nil, err
		}

		var property PropertyDefinitionDocument
		if err := json.Unmarshal([]byte(doc.Value().String()), &property); err != nil {
			_ = iter.Close()
			return nil, err
		}
		if property.DeletedAt == nil {
			properties = append(properties, property)
		}
	}
	if err := iter.Err(); err != nil {
		_ = iter.Close()
		return nil, err
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}

	sort.SliceStable(properties, func(i, j int) bool {
		if properties[i].Order == properties[j].Order {
			return properties[i].CreatedAt < properties[j].CreatedAt
		}
		return properties[i].Order < properties[j].Order
	})
	return properties, nil
}

func (s *Store) UpsertSelectValue(ctx context.Context, value SelectValueDocument) error {
	value = normalizeSelectValueDocument(value)
	return s.upsertJSON(ctx, "select_values", value)
}

func normalizeSelectValueDocument(value SelectValueDocument) SelectValueDocument {
	if value.Type == "" {
		value.Type = "selectValue"
	}
	if value.SchemaVersion == 0 {
		value.SchemaVersion = 1
	}
	return value
}

func (s *Store) UpsertSelectValues(ctx context.Context, selectValues []SelectValueDocument) error {
	values := make([]*anyenc.Value, 0, len(selectValues))
	for _, selectValue := range selectValues {
		value, err := marshalJSONValue(normalizeSelectValueDocument(selectValue))
		if err != nil {
			return err
		}
		values = append(values, value)
	}
	return s.upsertJSONValues(ctx, "select_values", values)
}

func (s *Store) ListSelectValues(ctx context.Context, workspaceID string, propertyID string) ([]SelectValueDocument, error) {
	coll, err := s.db.Collection(ctx, "select_values")
	if err != nil {
		return nil, err
	}

	query := map[string]any{"workspaceId": workspaceID}
	if propertyID != "" {
		query["propertyId"] = propertyID
	}
	iter, err := coll.Find(query).Iter(ctx)
	if err != nil {
		return nil, err
	}

	var values []SelectValueDocument
	for iter.Next() {
		doc, err := iter.Doc()
		if err != nil {
			_ = iter.Close()
			return nil, err
		}

		var value SelectValueDocument
		if err := json.Unmarshal([]byte(doc.Value().String()), &value); err != nil {
			_ = iter.Close()
			return nil, err
		}
		if value.DeletedAt == nil {
			values = append(values, value)
		}
	}
	if err := iter.Err(); err != nil {
		_ = iter.Close()
		return nil, err
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}

	sort.SliceStable(values, func(i, j int) bool {
		if values[i].Order == values[j].Order {
			return values[i].CreatedAt < values[j].CreatedAt
		}
		return values[i].Order < values[j].Order
	})
	return values, nil
}

func (s *Store) AppendPropertyHistory(ctx context.Context, history PropertyHistoryDocument) error {
	if history.Type == "" {
		history.Type = "propertyHistory"
	}
	if history.SchemaVersion == 0 {
		history.SchemaVersion = 1
	}
	return s.upsertJSON(ctx, "property_history", history)
}

func (s *Store) ListPropertyHistory(ctx context.Context, workspaceID string) ([]PropertyHistoryDocument, error) {
	coll, err := s.db.Collection(ctx, "property_history")
	if err != nil {
		return nil, err
	}

	iter, err := coll.Find(map[string]any{"workspaceId": workspaceID}).Iter(ctx)
	if err != nil {
		return nil, err
	}

	var history []PropertyHistoryDocument
	for iter.Next() {
		doc, err := iter.Doc()
		if err != nil {
			_ = iter.Close()
			return nil, err
		}

		var item PropertyHistoryDocument
		if err := json.Unmarshal([]byte(doc.Value().String()), &item); err != nil {
			_ = iter.Close()
			return nil, err
		}
		history = append(history, item)
	}
	if err := iter.Err(); err != nil {
		_ = iter.Close()
		return nil, err
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}

	sort.SliceStable(history, func(i, j int) bool {
		if history[i].CreatedAt == history[j].CreatedAt {
			return history[i].ID < history[j].ID
		}
		return history[i].CreatedAt < history[j].CreatedAt
	})
	return history, nil
}

func (s *Store) upsertJSON(ctx context.Context, collectionName string, doc any) error {
	value, err := marshalJSONValue(doc)
	if err != nil {
		return err
	}
	return s.upsertJSONValues(ctx, collectionName, []*anyenc.Value{value})
}

func (s *Store) upsertJSONValues(ctx context.Context, collectionName string, values []*anyenc.Value) error {
	return s.upsertJSONCollectionValues(ctx, []jsonCollectionValueBatch{{
		collectionName: collectionName,
		values:         values,
	}})
}

type jsonCollectionValueBatch struct {
	collectionName string
	values         []*anyenc.Value
}

type resolvedJSONCollectionValueBatch struct {
	collection anystore.Collection
	values     []*anyenc.Value
}

func (s *Store) upsertJSONCollectionValues(ctx context.Context, batches []jsonCollectionValueBatch) error {
	if len(batches) == 0 {
		return nil
	}

	resolvedBatches := make([]resolvedJSONCollectionValueBatch, 0, len(batches))
	for _, batch := range batches {
		coll, err := s.db.Collection(ctx, batch.collectionName)
		if err != nil {
			return err
		}
		resolvedBatches = append(resolvedBatches, resolvedJSONCollectionValueBatch{
			collection: coll,
			values:     batch.values,
		})
	}

	tx, err := s.db.WriteTx(ctx)
	if err != nil {
		return err
	}
	for _, batch := range resolvedBatches {
		for _, value := range batch.values {
			if err := batch.collection.UpsertOne(tx.Context(), value); err != nil {
				if rollbackErr := tx.Rollback(); rollbackErr != nil {
					return errors.Join(err, rollbackErr)
				}
				return err
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

func marshalJSONValue(doc any) (*anyenc.Value, error) {
	data, err := json.Marshal(doc)
	if err != nil {
		return nil, err
	}
	return anyenc.ParseJson(string(data))
}
