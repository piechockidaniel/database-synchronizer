# Column Reshaping UI Preview

## New Column Mapping Interface

### Before (Old UI)
```
┌────────────────────────────────────────────────────────────┐
│  Source Column ▼    →    Destination Column ▼    [Delete] │
│  (single select)         (single select)                   │
└────────────────────────────────────────────────────────────┘
```

**Limitations:**
- Only 1:1 column mapping
- No transformation support
- No preview of mapping

---

### After (New UI)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Column Mapping                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  SOURCE COLUMN(S)              →        DESTINATION COLUMN                   │
│  ┌─────────────────────┐                ┌───────────────────────────────┐   │
│  │ □ ID                │                │ Destination: [Select...    ▼] │   │
│  │ ☑ FirstName         │                │                               │   │
│  │ ☑ LastName          │                │ Transformation Type:          │   │
│  │ ☑ Email             │                │ [JSON Object            ▼]    │   │
│  │ □ Phone             │                │                               │   │
│  │ □ Address           │                │ ┌─────────────────────────┐   │   │
│  │ □ City              │                │ │ Preview:                │   │   │
│  │ □ State             │                │ │                         │   │   │
│  └─────────────────────┘                │ │ Sources: FirstName,     │   │   │
│  Select one or more                     │ │          LastName, Email│   │   │
│                                          │ │ Dest: UserData          │   │   │
│                                          │ │ Transform: JSON_OBJECT()│   │   │
│                                          │ └─────────────────────────┘   │   │
│                                          └───────────────────────────────┘   │
│                                                                    [Delete]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Multiple source columns (checkboxes)
- ✅ Transformation types dropdown
- ✅ Real-time preview
- ✅ Better visual layout

---

## Transformation Types

### 1. Direct Mapping (No Transformation)
```
┌─────────────────────────────────────────────┐
│ Transformation Type: [Direct Mapping   ▼]  │
│                                             │
│ Preview:                                    │
│ FirstName → FirstName                       │
└─────────────────────────────────────────────┘
```

### 2. JSON Object
```
┌──────────────────────────────────────────────────────────┐
│ Transformation Type: [JSON Object               ▼]      │
│                                                          │
│ Preview:                                                 │
│ Sources: FirstName, LastName, Email                     │
│ Destination: UserData                                   │
│ Transform: JSON_OBJECT('FirstName', FirstName,          │
│                        'LastName', LastName,            │
│                        'Email', Email)                  │
└──────────────────────────────────────────────────────────┘
```

### 3. Concatenation
```
┌──────────────────────────────────────────────────────────┐
│ Transformation Type: [Concatenation             ▼]      │
│                                                          │
│ Preview:                                                 │
│ Sources: Street, City, State, Zip                       │
│ Destination: FullAddress                                │
│ Transform: CONCAT(Street, ', ', City, ', ',            │
│                   State, ' ', Zip)                      │
└──────────────────────────────────────────────────────────┘
```

### 4. Custom SQL Expression
```
┌──────────────────────────────────────────────────────────┐
│ Transformation Type: [Custom SQL Expression     ▼]      │
│                                                          │
│ Custom Expression:                                       │
│ ┌────────────────────────────────────────────────────┐  │
│ │ {col1} * (1 + {col2}) * (1 - {col3}/100)          │  │
│ └────────────────────────────────────────────────────┘  │
│ Use {col1}, {col2}, etc. as placeholders               │
│                                                          │
│ Preview:                                                 │
│ Sources: BasePrice, TaxRate, DiscountPercent            │
│ Destination: FinalPrice                                 │
│ Transform: BasePrice * (1 + TaxRate) *                  │
│            (1 - DiscountPercent/100)                    │
└──────────────────────────────────────────────────────────┘
```

---

## Complete Mapping Form

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Create Table Mapping                                              [Close] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ① TABLE SELECTION                                                         │
│  ┌────────────────────────┐        ┌────────────────────────┐             │
│  │ SOURCE                 │        │ DESTINATION            │             │
│  │ Database: [dbo      ▼] │        │ Database: [dbo      ▼] │             │
│  │ Schema:   [dbo      ▼] │        │ Schema:   [dbo      ▼] │             │
│  │ Table:    [Users    ▼] │        │ Table:    [Profiles ▼] │             │
│  │ [Load Tables] [Columns]│        │ [Load Tables] [Columns]│             │
│  └────────────────────────┘        └────────────────────────┘             │
│                                                                             │
│  ② COLUMN MAPPING                                                          │
│  [Auto-Map] [Add Mapping] [Clear All]                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ [Mapping Card 1 - see detailed view above]                          │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ [Mapping Card 2 - see detailed view above]                          │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ [Mapping Card 3 - see detailed view above]                          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ③ SYNCHRONIZATION OPTIONS                                                 │
│  Mapping ID: [map_users_to_profiles_1234567890]                           │
│  ☑ Enable Mapping                                                          │
│  ☑ Sync Inserts    ☑ Sync Updates    ☑ Sync Deletes                      │
│                                                                             │
│  [Cancel]                                              [Save Mapping]      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Mappings List View

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Table Mappings                                          [Create New]      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ dbo.Users → dbo.UserProfiles                                         │ │
│  │ Columns: 5 mapped  [3 direct]  [2 transformed]                       │ │
│  │ Status: [Enabled]                                                    │ │
│  │ [View Details]  [Delete]                                             │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ dbo.Products → dbo.ProductPricing                                    │ │
│  │ Columns: 3 mapped  [2 direct]  [1 transformed]                       │ │
│  │ Status: [Enabled]                                                    │ │
│  │ [View Details]  [Delete]                                             │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Mapping Details Modal

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Mapping Details: map_users_to_profiles                          [Close]   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Source: dbo.Users                                                         │
│  Destination: dbo.UserProfiles                                             │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Column Mappings:                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐│
│  │ Source Column(s)      │ Destination Column │ Transformation           ││
│  ├───────────────────────┼────────────────────┼──────────────────────────┤│
│  │ UserID                │ UserID             │ -                        ││
│  ├───────────────────────┼────────────────────┼──────────────────────────┤│
│  │ FirstName, LastName,  │ PersonalInfo       │ [JSON Object]            ││
│  │ DateOfBirth           │                    │ JSON_OBJECT(...)         ││
│  ├───────────────────────┼────────────────────┼──────────────────────────┤│
│  │ Email, Phone          │ ContactInfo        │ [JSON Object]            ││
│  │                       │                    │ JSON_OBJECT(...)         ││
│  ├───────────────────────┼────────────────────┼──────────────────────────┤│
│  │ Street, City, State   │ FullAddress        │ [Concatenation]          ││
│  │                       │                    │ CONCAT(...)              ││
│  └───────────────────────┴────────────────────┴──────────────────────────┘│
│                                                                             │
│  Sync Inserts: ✓    Sync Updates: ✓    Sync Deletes: ✓                   │
│                                                                             │
│  [Close]                                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Color Coding

- **[3 direct]** - Blue badge - Simple 1:1 mappings
- **[2 transformed]** - Orange badge - Complex transformations
- **[Enabled]** - Green badge - Active mapping
- **[Disabled]** - Gray badge - Inactive mapping

---

## Responsive Design

The interface is fully responsive:
- Desktop: Full side-by-side layout
- Tablet: Stacked layout with scroll
- Mobile: Card-based layout

---

## Accessibility Features

- ✅ Keyboard navigation support
- ✅ Screen reader compatible
- ✅ Clear labels and descriptions
- ✅ Color-blind friendly badges
- ✅ High contrast mode support

---

## Browser Support

Tested on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+

---

## Performance

- ✅ Smooth scrolling for 100+ columns
- ✅ Instant preview updates
- ✅ Lazy rendering for large lists
- ✅ Optimized checkbox rendering

