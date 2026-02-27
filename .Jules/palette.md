## 2026-02-27 - Nesting Tooltip and DropdownMenu
**Learning:** When combining Radix UI `Tooltip` and `DropdownMenu` on the same trigger element, the correct nesting structure is `DropdownMenu` > `Tooltip` > `TooltipTrigger asChild` > `DropdownMenuTrigger asChild` > `Button`. This order prevents interaction conflicts and ensures the tooltip disappears when the menu opens.
**Action:** Always follow this nesting order for components using both primitives on a single trigger.
