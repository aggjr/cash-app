# Database Schema Documentation

## Tipo Entrada Tree Structure

### Table: `tipo_entrada`

Stores hierarchical entry types using the **Adjacency List** pattern.

#### Columns:
- `id` - Primary key (auto-increment)
- `label` - Name of the entry type (e.g., "Receita Operacional", "STOCKSPIN")
- `parent_id` - Foreign key to parent node (NULL for root nodes)
- `ordem` - Order/position among siblings
- `expanded` - UI state (whether node is expanded in tree view)
- `created_at` - Timestamp of creation
- `updated_at` - Timestamp of last update

#### Key Features:
- **Self-referencing foreign key** for parent-child relationships
- **CASCADE DELETE** - Deleting a parent automatically deletes all children
- **Indexed** on `parent_id` and `ordem` for performance

### Common Operations:

#### 1. Get Root Nodes
```sql
SELECT * FROM tipo_entrada WHERE parent_id IS NULL ORDER BY ordem;
```

#### 2. Get Children of a Node
```sql
SELECT * FROM tipo_entrada WHERE parent_id = 1 ORDER BY ordem;
```

#### 3. Get Full Tree (Recursive)
```sql
WITH RECURSIVE tree AS (
    SELECT id, label, parent_id, ordem, 0 AS depth
    FROM tipo_entrada
    WHERE parent_id IS NULL
    UNION ALL
    SELECT t.id, t.label, t.parent_id, t.ordem, tree.depth + 1
    FROM tipo_entrada t
    INNER JOIN tree ON t.parent_id = tree.id
)
SELECT * FROM tree ORDER BY depth, ordem;
```

#### 4. Move a Node
```sql
UPDATE tipo_entrada SET parent_id = 2 WHERE id = 5;
```

#### 5. Reorder Siblings
```sql
UPDATE tipo_entrada SET ordem = 1 WHERE id = 3;
UPDATE tipo_entrada SET ordem = 2 WHERE id = 2;
```

### Integration with Frontend

The current frontend uses `localStorage`. To integrate with this SQL database:

1. **Backend API** (Node.js/Express, Python/Flask, etc.)
2. **REST Endpoints**:
   - `GET /api/tipo-entrada` - Get all nodes
   - `POST /api/tipo-entrada` - Create new node
   - `PUT /api/tipo-entrada/:id` - Update node
   - `DELETE /api/tipo-entrada/:id` - Delete node
   - `PUT /api/tipo-entrada/:id/move` - Move node (change parent)
   - `PUT /api/tipo-entrada/:id/reorder` - Reorder siblings

3. **Update `TreeManager.js`** to fetch/save to API instead of localStorage
