# GemPixel

## What This Is

GemPixel is a client-side utility web application designed for diamond painting/gem art artists. It takes a user-loaded picture and converts it into a grid representation showing how it will look as gem art, matching the image colors to standard Art Dot/DMC manufacturer color indexes (100 and 200 color kits) and custom sub-palettes. It serves as a supply planning tool that outputs the exact color codes and dot counts needed for the canvas.

## Core Value

Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Load local images (JPEG, PNG, etc.) in-browser.
- [ ] Render a pixelated grid representation of the image.
- [ ] Specify canvas size using two modes: direct grid dimensions (rows/cols) or physical dimensions (cm/inches) with standard density calculations (2.5mm per dot, 10 dots/inch).
- [ ] Map each pixel/grid cell to the nearest available DMC color from selected color indexes using RGB/Lab color distance formulas.
- [ ] Support Art Dot 100-color and 200-color manufacturer indexes.
- [ ] Support custom sub-palette selection/filtering (allowing the artist to include or exclude specific colors from matching).
- [ ] Display a supply specification report showing required color codes, names, and exact quantities of dots needed.
- [ ] Enable visual inspection of the grid with zoom/pan and custom styling (square vs. round drill representation).

### Out of Scope

- [ ] Server-side processing or user accounts — keep the utility lightweight and run entirely client-side.
- [ ] AI-based color enhancement or style generation — stick to clean mathematical color matching.
- [ ] Direct purchase integration — supply count lists should be exported or copied, not purchased inside the app.

## Context

The target user is a professional or hobbyist gem art artist who takes custom commissions. Currently, there is no simple tool to map custom image colors to the specific Art Dot kits (100 and 200 colors). A key pain point is estimating the exact number of gem drills needed before starting a project.

## Constraints

- **Tech Stack**: Vanilla HTML/JavaScript/CSS or a lightweight framework running entirely in-browser.
- **Color Accuracy**: Colors must map to the standard DMC color code system since Art Dot matches DMC numbers.
- **Privacy & Speed**: Run completely in the browser; images should never upload to a server.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side processing | Fast, secure, zero server maintenance costs. | — Pending |
| Multi-resizing modes | Supports both canvas purchasing (cm/inches) and detailed planning (rows/cols). | — Pending |
| Art Dot Kit Indexing | Direct mapping to 100/200 sets to match user's physical inventory. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-06 after project initialization*
