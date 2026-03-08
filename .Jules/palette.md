## 2026-02-28 - Theme Toggle Tooltip & Nesting
**Learning:** In applications using both Radix UI `Tooltip` and `DropdownMenu` on a single trigger (like a theme toggle), the specific nesting order `DropdownMenu` > `Tooltip` > `TooltipTrigger asChild` > `DropdownMenuTrigger asChild` > `Button` is essential to prevent event bubbling conflicts and ensure the tooltip correctly hides when the menu is opened.
**Action:** Always apply this nesting pattern for any icon-only buttons that also trigger dropdown menus to maintain both accessibility (tooltips) and expected menu behavior.
