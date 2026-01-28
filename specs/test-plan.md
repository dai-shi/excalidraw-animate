# Excalidraw Animate Test Plan

## Test Data Setup

testHelpers: `src/__testHelpers/creationForTests.ts`

Storage Keys:

- Application Data: `excalidraw-app`
- Theme: `theme`

Setup pattern (localStorage + reload):

```typescript
await page.goto('/');
await page.evaluate((data) => {
  localStorage.setItem('excalidraw-app', JSON.stringify(data));
}, drawingData);
await page.reload();
```

## 1. Export SVG Modal (High Priority)

Prerequisite: svgList must be generated (after clicking Animate!)

| ID      | Scenario                      | Steps                                                     | Expected                                      |
| ------- | ----------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| EXP-001 | Open modal via button         | 1. Load drawing 2. Click Animate! 3. Click Export to SVG  | Modal opens with Background/Dark mode toggles |
| EXP-002 | Close modal via Escape        | 1. Open modal 2. Press Escape                             | Modal closes                                  |
| EXP-003 | Close modal via overlay click | 1. Open modal 2. Click outside modal                      | Modal closes                                  |
| EXP-004 | Background toggle             | 1. Open modal 2. Toggle Background                        | Toggle state changes                          |
| EXP-005 | Dark mode toggle              | 1. Open modal 2. Toggle Dark mode                         | Toggle state changes                          |
| EXP-006 | Export light + no background  | 1. Open modal 2. Background OFF, Dark OFF 3. Click Export | SVG downloaded                                |
| EXP-007 | Export light + background     | 1. Open modal 2. Background ON, Dark OFF 3. Click Export  | SVG downloaded                                |
| EXP-008 | Export dark + no background   | 1. Open modal 2. Background OFF, Dark ON 3. Click Export  | SVG downloaded                                |
| EXP-009 | Export dark + background      | 1. Open modal 2. Background ON, Dark ON 3. Click Export   | SVG downloaded                                |
| EXP-010 | Button hidden without data    | 1. Load page without drawing                              | Export to SVG button not visible              |

## 2. Playback Controls (High Priority)

Prerequisite: svgListが必要

| ID       | Scenario                        | Steps                                             | Expected                    |
| -------- | ------------------------------- | ------------------------------------------------- | --------------------------- |
| PLAY-001 | Play button                     | 1. Load drawing 2. Animate! 3. Click Play         | Animation starts            |
| PLAY-002 | Pause button                    | 1. Play animation 2. Click Pause                  | Animation pauses            |
| PLAY-003 | Play via P key                  | 1. Load drawing 2. Animate! 3. Press P            | Animation toggles           |
| PLAY-004 | Step button                     | 1. Load drawing 2. Animate! 3. Click Step         | Animation advances one step |
| PLAY-005 | Step via S key                  | 1. Load drawing 2. Animate! 3. Press S            | Animation advances one step |
| PLAY-006 | Reset button                    | 1. Play animation 2. Click Reset                  | Animation resets to start   |
| PLAY-007 | Reset via R key                 | 1. Play animation 2. Press R                      | Animation resets to start   |
| PLAY-008 | Hide Toolbar button             | 1. Load drawing 2. Animate! 3. Click Hide Toolbar | Toolbar hides               |
| PLAY-009 | Hide Toolbar via Q key          | 1. Load drawing 2. Animate! 3. Press Q            | Toolbar hides               |
| PLAY-010 | Show toolbar after hide via key | 1. Hide toolbar 2. Press any key                  | Toolbar shows               |

## 3. AnimateConfig (Medium Priority)

Prerequisite: An element must be selected

| ID      | Scenario                       | Steps                                               | Expected                       |
| ------- | ------------------------------ | --------------------------------------------------- | ------------------------------ |
| CFG-001 | Order input single element     | 1. Select one element 2. Enter Order value          | Order applied to element       |
| CFG-002 | Duration input single element  | 1. Select one element 2. Enter Duration value       | Duration applied to element    |
| CFG-003 | Disabled when no selection     | 1. Deselect all elements                            | Order/Duration inputs disabled |
| CFG-004 | Mixed values display           | 1. Select multiple elements with different Order    | "Mixed" placeholder shown      |
| CFG-005 | Mixed values preserve on empty | 1. Select mixed elements 2. Leave empty 3. Deselect | Original values preserved      |
| CFG-006 | Mixed values apply on input    | 1. Select mixed elements 2. Enter value             | Value applied to all           |
| CFG-007 | Order zero value               | 1. Select element 2. Enter 0                        | Order set to 0                 |
| CFG-008 | Duration minimum value         | 1. Select element 2. Enter 1                        | Duration set to 1ms            |
| CFG-009 | Pointer URL input              | 1. Enter pointer image URL                          | Pointer image loads            |
| CFG-010 | Pointer file upload            | 1. Upload pointer image file                        | Pointer image loads            |
| CFG-011 | Pointer width input            | 1. Enter pointer width value                        | Pointer width applied          |

## 4. File Loading Error (Medium Priority)

| ID      | Scenario                     | Steps                                      | Expected                        |
| ------- | ---------------------------- | ------------------------------------------ | ------------------------------- |
| ERR-001 | Invalid link format          | 1. Enter invalid URL in link input         | Alert shown                     |
| ERR-002 | Non-existent Excalidraw link | 1. Enter valid format but non-existent URL | Error handled gracefully        |
| ERR-003 | Invalid file upload          | 1. Upload non-Excalidraw file              | Error message shown             |
| ERR-004 | Empty link submit            | 1. Submit empty link input                 | No action or validation message |

## 5. Keyboard Shortcuts (Low Priority)

| ID      | Scenario                    | Steps                                       | Expected                      |
| ------- | --------------------------- | ------------------------------------------- | ----------------------------- |
| KEY-001 | P key toggles play/pause    | 1. Load animation 2. Press P multiple times | Alternates between play/pause |
| KEY-002 | S key steps forward         | 1. Load animation 2. Press S                | Animation advances one step   |
| KEY-003 | R key resets                | 1. Play animation 2. Press R                | Animation resets              |
| KEY-004 | Q key toggles toolbar       | 1. Load animation 2. Press Q                | Toolbar visibility toggles    |
| KEY-005 | Case insensitive            | 1. Press lowercase p/s/r/q                  | Same behavior as uppercase    |
| KEY-006 | No effect without animation | 1. Fresh page 2. Press P/S/R/Q              | No errors, no action          |

- Keyboard shortcut tests are mostly covered by existing Playback tests.

## Existing Tests (e2e/basic.spec.ts)

- page loads with main UI elements
- can switch between Edit and Animate modes
- can toggle theme
