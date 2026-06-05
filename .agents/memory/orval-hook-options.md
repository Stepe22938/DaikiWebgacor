---
name: Orval hook query options
description: How to pass custom options (enabled, refetchInterval) to Orval-generated React Query hooks without TS errors.
---

## Rule

When passing `enabled`, `refetchInterval`, or any custom option to an Orval-generated query hook, you **must** spread the auto-generated `getXxxQueryOptions()` helper into the `query` object. Without it, TypeScript errors with TS2741 (`queryKey` missing).

**Wrong:**
```tsx
useListConversations({ query: { refetchInterval: 5000 } }) // TS2741
```

**Correct:**
```tsx
import { getListConversationsQueryOptions } from "@workspace/api-client-react";

useListConversations({
  query: { ...getListConversationsQueryOptions(), refetchInterval: 5000 },
});
```

For hooks that take a path param (e.g. `id`), pass it to both the hook and the helper:
```tsx
useListMessages(id, {
  query: {
    ...getListMessagesQueryOptions(id),
    enabled: id !== null,
    refetchInterval: 2000,
  },
});
```

**Why:** Orval generates `query` typed as `UseQueryOptions<...>` which requires `queryKey`. The `getXxxQueryOptions()` helper provides the auto-generated queryKey, satisfying the type.

**How to apply:** Any time you need `enabled`, `refetchInterval`, `staleTime`, or any other react-query option on an Orval hook.
