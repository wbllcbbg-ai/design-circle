# 点评系统重构 — Implementation Plan

**Goal:** Redesign the review system: restrict review entry points, add AI & admin moderation, remove review from publish page.

**Architecture:** Phase 1 = DB migration + review status fields + basic AI mock + source tracking. Phase 2 = UI changes (entry points). Phase 3 = Admin review panel.

## Phase 1: Database + API Changes (AI Mock + Source Tracking)

### Task 1: Database Migration

**Files:**
- Modify: `supabase/migrations/00001_schema.sql`

Add after `user_points` table:
```sql
-- 点评审核字段 (reviews 表新增)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'flagged'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_source TEXT
  CHECK (review_source IN ('consult', 'browse', 'transaction'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);

-- 审核标记表
CREATE TABLE IF NOT EXISTS review_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Task 2: Update POST /api/reviews — Add Source + AI Mock Review

**Files:**
- Modify: `src/app/api/reviews/route.ts`

Changes:
1. Accept `source` field (consult/browse/transaction)
2. After insert, run `aiReview()` mock function
3. If confidence > 0.7 → auto approve. Else → pending
4. Update review_status accordingly

Mock AI review function:
```typescript
function aiReview(content: string, rating: number): { status: string; confidence: number; flags: string[] } {
  const badWords = ["广告", "加微信", "电话", "假的", "骗子"]
  const hasBad = badWords.some(w => content.includes(w))
  
  if (hasBad) {
    return { status: "flagged", confidence: 0.2, flags: ["suspicious_content"] }
  }
  if (content.length < 10) {
    return { status: "flagged", confidence: 0.3, flags: ["too_short"] }
  }
  if (rating >= 3 && content.length > 20) {
    return { status: "approved", confidence: 0.9, flags: [] }
  }
  return { status: "pending", confidence: 0.6, flags: [] }
}
```

### Task 3: Add Check-Access API

**Files:**
- Create: `src/app/api/reviews/check-access/route.ts`

Check if current user has right to review a designer:
- Check conversations table: user has messaged this designer
- Check browse_history: user has viewed this designer's cases
- Check reviews: user hasn't already reviewed this designer
- Return: { can_review: boolean, source: string | null, reason: string }

### Task 4: Admin Review List API

**Files:**
- Create: `src/app/api/admin/reviews/route.ts`
- Create: `src/app/api/admin/reviews/[id]/route.ts`

GET /api/admin/reviews — list pending/flagged reviews with designer info
PUT /api/admin/reviews/[id] — approve or reject, set review_status and reviewed_at

## Phase 2: UI Changes

### Task 5: Remove Review from Publish Page

**Files:**
- Modify: `src/app/publish/page.tsx`

Remove the "写点评" button from the publish page. Only keep "发布案例" and "提问求助".

### Task 6: Add Review Entry to Designer Detail Page

**Files:**
- Modify: `src/app/designers/[id]/page.tsx`

Add "写评价" button below the "咨询" button. Before showing, call check-access API. If user can review → show button. If not → show reason.

### Task 7: Add Review Entry to Case Detail Page

**Files:**
- Modify: `src/app/cases/[id]/page.tsx`

In the review summary section, add "我也要评价这个设计师" link that navigates to the designer page with review mode.

### Task 8: Add Review Entry to Messages Page

**Files:**
- Modify: `src/app/messages/page.tsx`

For conversations with designers, add a "写评价" button next to each conversation item.

## Phase 3: Admin Review Panel

### Task 9: Admin Review Page

**Files:**
- Create: `src/app/admin/reviews/page.tsx`

List pending/flagged reviews with: content, rating, designer name, source, ai confidence score, actions (approve/reject).

### Task 10: Admin Navigation

**Files:**
- Modify: `src/app/admin/page.tsx`

Add "点评审核" link to admin navigation bar.
